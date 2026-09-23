import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { generateAlgorithmicQuestions } from "../utils/algorithmicQuestionGenerator";
import { storage } from "./store";
import {
  authenticateAdmin,
  verifySessionToken,
  revokeSessionToken,
  requireAdminAuth,
  createRateLimiter,
  getClientIp,
  sanitizeInput,
} from "./security";

export const apiRouter = express.Router();

// Rate Limiters for Security Hardening
const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: "Xavfsizlik tizimi: Kirish urinishlari limiti oshib ketdi. Iltimos 15 daqiqadan keyin urinib ko'ring.",
});

const evaluateRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "Javoblarni tekshirish so'rovlari limiti oshdi. Biroz kuting.",
});

// Lazy init GenAI (Optional: app works seamlessly with or without GEMINI_API_KEY)
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return null;
  }
  if (!aiClient) {
    try {
      aiClient = new GoogleGenAI({
        apiKey: apiKey.trim(),
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    } catch (e) {
      console.warn("Could not initialize GenAI client:", e);
      return null;
    }
  }
  return aiClient;
}

// 0. Health route
apiRouter.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ==========================================
// ADMIN AUTHENTICATION ENDPOINTS (SECURE)
// ==========================================

// 1. Admin Login (Username: aistudio, Password: salom7852qaz)
apiRouter.post("/admin/login", loginRateLimiter, (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "Login va parol kiritilishi shart!",
      });
    }

    const clientIp = getClientIp(req);
    const authResult = authenticateAdmin(String(username), String(password), clientIp);

    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        error: authResult.error,
        remainingAttempts: authResult.remainingAttempts,
        lockedSeconds: authResult.lockedSeconds,
      });
    }

    return res.json({
      success: true,
      token: authResult.token,
      message: "Admin tizimiga muvaffaqiyatli kirildi.",
    });
  } catch (error: any) {
    console.error("Admin login error:", error);
    return res.status(500).json({ success: false, error: "Tizim xatoligi yuz berdi" });
  }
});

// 2. Admin Token Verification
apiRouter.get("/admin/verify", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ valid: false });
  }

  const token = authHeader.slice(7).trim();
  const isValid = verifySessionToken(token);
  return res.json({ valid: isValid });
});

// 3. Admin Logout
apiRouter.post("/admin/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    revokeSessionToken(token);
  }
  return res.json({ success: true, message: "Admin sessiyasi yakunlandi." });
});

// Sleep helper
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to run question generation for a slice
async function generateQuestionBatch(
  ai: GoogleGenAI,
  bookTitle: string,
  author: string,
  grade: string,
  contentSlice: string,
  mcCount: number,
  wrCount: number,
  batchTheme: string
): Promise<{ multipleChoiceQuestions: any[]; writtenQuestions: any[] }> {
  const prompt = `Siz maktab ta'limi va o'zbek adabiyoti bo'yicha oliy toifali ekspert, professional testolog va metodistsiz.
Quyida taqdim etilgan kitob asari matni asosida o'quvchilar uchun YUQORI SAVIYALI, PROFESSIONAL TEST SAVOLLARI tuzing.

Kitob ma'lumotlari:
- Kitob nomi: "${bookTitle}"
- Muallif: "${author || "Muallif"}"
- Tavsiya etilgan sinf: "${grade || "Maktab"}"
- Fokus/Boblar: "${batchTheme}"

MUTLAQ TALABLAR VA PROFESSIONAL MEZONLAR:
1. SAVOLLARNING YUQORI SAVIYASI:
   - Savollar yuzaki bo'lmasin. Syujet ziddiyatlari, qahramonlarning ruhiy olami, xarakterlari, motivatsiyasi va muallif g'oyasini qamrasin.
2. CHALG'ITUVCHI VARIANTLAR BIR-BIRIGA JUDA YAQIN BO'LSIN:
   - 4 ta variant (A, B, C, D) bir-biriga JUDA YAQIN, mantiqiy va ishonarli bo'lsin.
   - O'quvchi kitobni sinchiklab o'qimagan bo'lsa, shunchaki taxmin qila olmasin.
   - Noto'g'ri variantlar kitobdagi boshqa o'xshash voqealar yoki qahramonlar xatti-harakatlariga asoslansin.
3. YOZMA SAVOLLAR:
   - O'quvchidan asar voqealari va sabab-oqibatlari bo'yicha mazmunli javob talab etilsin.
   - Har bir yozma savol uchun to'g'ri etalon javob (expectedAnswer) va tekshirish uchun 2-4 ta kalit so'z (keywords) berilsin.
4. MIQDOR:
   - Aynan ${mcCount} ta variantli savol (A, B, C, D; bittasi to'g'ri).
   - Aynan ${wrCount} ta javobi yoziladigan savol.

Matn:
"""
${contentSlice}
"""`;

  const modelsToTry = ["gemini-3.1-flash-lite", "gemini-3.8-flash"];
  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction:
              "Siz O'zbekiston Respublikasi maktab ta'limi bo'yicha oliy toifali testolog-ekspertsiz. Kitoblar bo'yicha chuqur saviyali, variantlari bir-biriga nihoyatda yaqin, chalg'ituvchi pedagogik testlar tuzasiz. Faqat JSON formatda javob bering.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                multipleChoiceQuestions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      correctOptionIndex: { type: Type.INTEGER },
                      explanation: { type: Type.STRING },
                    },
                    required: ["question", "options", "correctOptionIndex"],
                  },
                },
                writtenQuestions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING },
                      expectedAnswer: { type: Type.STRING },
                      keywords: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                    },
                    required: ["question", "expectedAnswer"],
                  },
                },
              },
              required: ["multipleChoiceQuestions", "writtenQuestions"],
            },
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          return {
            multipleChoiceQuestions: parsed.multipleChoiceQuestions || [],
            writtenQuestions: parsed.writtenQuestions || [],
          };
        }
      } catch (err) {
        console.warn(`Attempt ${attempt} on ${modelName} failed:`, err);
        await sleep(1500);
      }
    }
  }

  throw new Error("Savollarni yaratishda model javob bermadi");
}

// 4. Professional AI Question Generation API (Admin protected)
apiRouter.post("/generate-questions", requireAdminAuth, async (req, res) => {
  try {
    const {
      bookTitle,
      author,
      grade,
      bookText,
      multipleChoiceCount = 60,
      writtenCount = 20,
    } = req.body;

    const safeTitle = sanitizeInput(bookTitle, 200);
    const safeAuthor = sanitizeInput(author, 200);
    const safeGrade = sanitizeInput(grade, 100);
    const finalContent = sanitizeInput(bookText || "", 2000000);

    if (!safeTitle) {
      return res.status(400).json({
        error: "Kitob nomi kiritilishi shart.",
      });
    }

    if (!finalContent || finalContent.length < 30) {
      return res.status(400).json({
        error: "Kitob matni kiritilishi shart. Iltimos PDF kitob yuklang yoki matnni kiriting.",
      });
    }

    const ai = getGenAI();

    // 1. If GEMINI_API_KEY is not configured, seamlessly generate using the built-in smart algorithmic generator
    if (!ai) {
      console.log("No GEMINI_API_KEY configured. Generating high-quality questions algorithmically from text.");
      const algorithmicResult = generateAlgorithmicQuestions(
        safeTitle,
        safeAuthor,
        safeGrade,
        finalContent,
        Number(multipleChoiceCount),
        Number(writtenCount)
      );

      return res.json({
        success: true,
        data: {
          multipleChoiceQuestions: algorithmicResult.multipleChoiceQuestions,
          writtenQuestions: algorithmicResult.writtenQuestions,
          mode: 'algorithmic'
        },
        notice: "Savollar o'rnatilgan aqlli lingvistik algoritm orqali (API kalitsiz) yaratildi."
      });
    }

    const totalCount = Number(multipleChoiceCount) + Number(writtenCount);

    let allMC: any[] = [];
    let allWritten: any[] = [];

    try {
      if (totalCount > 35) {
        const halfMC = Math.ceil(Number(multipleChoiceCount) / 2);
        const remainingMC = Number(multipleChoiceCount) - halfMC;
        const halfWritten = Math.ceil(Number(writtenCount) / 2);
        const remainingWritten = Number(writtenCount) - halfWritten;

        const midPoint = Math.floor(finalContent.length / 2);
        const part1 = finalContent.slice(0, Math.min(midPoint + 2000, 35000));
        const part2 = finalContent.slice(Math.max(0, midPoint - 2000), Math.min(finalContent.length, midPoint + 35000));

        const batch1 = await generateQuestionBatch(
          ai,
          safeTitle,
          safeAuthor,
          safeGrade,
          part1,
          halfMC,
          halfWritten,
          "Kitobning 1-qismi, qahramonlar tanishuvi, asar ekspozitsiyasi va asosiy voqealar boshlanishi"
        );

        const batch2 = await generateQuestionBatch(
          ai,
          safeTitle,
          safeAuthor,
          safeGrade,
          part2.length > 50 ? part2 : part1,
          remainingMC,
          remainingWritten,
          "Kitobning 2-qismi, kulminatsiya, qahramonlar fojiasi/yechimi, falsafiy ma'no va muallif xulosasi"
        );

        allMC = [...batch1.multipleChoiceQuestions, ...batch2.multipleChoiceQuestions];
        allWritten = [...batch1.writtenQuestions, ...batch2.writtenQuestions];
      } else {
        const singleBatch = await generateQuestionBatch(
          ai,
          safeTitle,
          safeAuthor,
          safeGrade,
          finalContent.slice(0, 35000),
          Number(multipleChoiceCount),
          Number(writtenCount),
          "Butun kitob bo'yicha to'liq savollar to'plami"
        );
        allMC = singleBatch.multipleChoiceQuestions;
        allWritten = singleBatch.writtenQuestions;
      }

      return res.json({
        success: true,
        data: {
          multipleChoiceQuestions: allMC,
          writtenQuestions: allWritten,
          mode: 'ai'
        },
      });
    } catch (genAiError) {
      console.warn("AI generation failed, smoothly falling back to algorithmic generator:", genAiError);
      const fallbackResult = generateAlgorithmicQuestions(
        safeTitle,
        safeAuthor,
        safeGrade,
        finalContent,
        Number(multipleChoiceCount),
        Number(writtenCount)
      );

      return res.json({
        success: true,
        data: {
          multipleChoiceQuestions: fallbackResult.multipleChoiceQuestions,
          writtenQuestions: fallbackResult.writtenQuestions,
          mode: 'algorithmic'
        },
        notice: "Savollar o'rnatilgan aqlli lingvistik algoritm orqali (API kalitsiz) yaratildi."
      });
    }
  } catch (error: any) {
    console.error("AI Generation error:", error);
    return res.status(500).json({
      error: error?.message || "Savollarni yaratishda xatolik yuz berdi",
    });
  }
});

// 5. AI Written Answers Semantic Evaluation API (Rate limited & sanitized)
apiRouter.post("/evaluate-written-answers", evaluateRateLimiter, async (req, res) => {
  try {
    const { evaluations, bookTitle } = req.body;
    if (!evaluations || !Array.isArray(evaluations) || evaluations.length === 0) {
      return res.json({ success: true, evaluations: [] });
    }

    const ai = getGenAI();
    const resultsMap = new Map<string, { isAccepted: boolean; feedback: string }>();
    const itemsToEvaluate: any[] = [];

    evaluations.forEach((item: any) => {
      const studentText = (item.studentAnswer || "").trim();
      if (!studentText) {
        resultsMap.set(item.questionId, {
          isAccepted: false,
          feedback: "Javob yozilmadi.",
        });
      } else {
        itemsToEvaluate.push(item);
      }
    });

    if (itemsToEvaluate.length > 0) {
      if (ai) {
        const evaluationPrompt = `Siz maktab o'quvchilari javoblarini baholovchi adolatli va professional adabiyot o'qituvchisisiz.
Kitob: "${bookTitle || "Adabiy asar"}"

Vazifa: O'quvchining yozma javoblarini etalon javob (expectedAnswer) va kalit so'zlar (keywords) bilan solishtirib tekshiring.
O'quvchi ma'noni to'g'ri ifodalagan bo'lsa (so'zma-so'z mos kelishi shart emas, asosiy mazmun va fakt to'g'ri bo'lsa), javobni qabul qiling (isAccepted: true).
Agar butunlay noto'g'ri yoki mavzuga aloqador bo'lmasa, qabul qilmang (isAccepted: false).

Baholanishi kerak bo'lgan savol va javoblar:
${JSON.stringify(itemsToEvaluate, null, 2)}

Har bir savol uchun o'zbek tilida qisqa va aniq konstruktiv fikr (feedback) bering.`;

        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: evaluationPrompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  evaluations: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        questionId: { type: Type.STRING },
                        isAccepted: { type: Type.BOOLEAN },
                        feedback: { type: Type.STRING },
                      },
                      required: ["questionId", "isAccepted", "feedback"],
                    },
                  },
                },
                required: ["evaluations"],
              },
            },
          });

          if (response.text) {
            const parsed = JSON.parse(response.text);
            if (Array.isArray(parsed.evaluations)) {
              parsed.evaluations.forEach((item: any) => {
                resultsMap.set(item.questionId, {
                  isAccepted: !!item.isAccepted,
                  feedback: item.feedback || (item.isAccepted ? "To'g'ri javob" : "Noto'g'ri javob"),
                });
              });
            }
          }
        } catch (aiErr) {
          console.warn("AI semantic evaluation fallback triggered:", aiErr);
          itemsToEvaluate.forEach((item: any) => {
            const studentAns = (item.studentAnswer || "").toLowerCase().trim();
            const expectedAns = (item.expectedAnswer || "").toLowerCase().trim();
            const kwList: string[] = item.keywords || [];

            let matched =
              studentAns === expectedAns ||
              expectedAns.includes(studentAns) ||
              studentAns.includes(expectedAns);

            if (!matched && kwList.length > 0) {
              matched = kwList.some((kw) => studentAns.includes(kw.toLowerCase().trim()));
            }

            resultsMap.set(item.questionId, {
              isAccepted: matched,
              feedback: matched ? "To'g'ri deb qabul qilindi." : "Etalon javobga to'g'ri kelmadi.",
            });
          });
        }
      } else {
        // Direct semantic matching without API key
        itemsToEvaluate.forEach((item: any) => {
          const studentAns = (item.studentAnswer || "").toLowerCase().trim();
          const expectedAns = (item.expectedAnswer || "").toLowerCase().trim();
          const kwList: string[] = item.keywords || [];

          let matched =
            studentAns === expectedAns ||
            expectedAns.includes(studentAns) ||
            studentAns.includes(expectedAns);

          if (!matched && kwList.length > 0) {
            matched = kwList.some((kw) => studentAns.includes(kw.toLowerCase().trim()));
          }

          resultsMap.set(item.questionId, {
            isAccepted: matched,
            feedback: matched ? "To'g'ri deb qabul qilindi." : "Etalon javobga to'g'ri kelmadi.",
          });
        });
      }
    }

    const finalEvaluations = evaluations.map((item: any) => ({
      questionId: item.questionId,
      isAccepted: resultsMap.get(item.questionId)?.isAccepted || false,
      feedback: resultsMap.get(item.questionId)?.feedback || "Baholandi.",
    }));

    return res.json({
      success: true,
      evaluations: finalEvaluations,
    });
  } catch (error: any) {
    console.error("Evaluate written answers error:", error);
    return res.status(500).json({ error: error?.message || "Baholashda xatolik yuz berdi" });
  }
});

// ==========================================
// CENTRALIZED DATA SYNC ENDPOINTS (MULTI-DEVICE)
// ==========================================

// 1. Get all books
apiRouter.get("/books", (req, res) => {
  try {
    const books = storage.getBooks();
    return res.json({ success: true, books });
  } catch (err: any) {
    console.error("Get books error:", err);
    return res.status(500).json({ success: false, error: "Kitoblarni yuklashda xatolik" });
  }
});

// 2. Save all books (or add new books)
apiRouter.post("/books", (req, res) => {
  try {
    const { books } = req.body || {};
    if (!Array.isArray(books)) {
      return res.status(400).json({ success: false, error: "Kitoblar ro'yxati noto'g'ri formatda" });
    }
    const saved = storage.saveBooks(books);
    return res.json({ success: true, books: saved, message: "Kitoblar markaziy serverga saqlandi" });
  } catch (err: any) {
    console.error("Save books error:", err);
    return res.status(500).json({ success: false, error: "Kitoblarni saqlashda xatolik" });
  }
});

// 3. Get all test results
apiRouter.get("/results", (req, res) => {
  try {
    const results = storage.getResults();
    return res.json({ success: true, results });
  } catch (err: any) {
    console.error("Get results error:", err);
    return res.status(500).json({ success: false, error: "Natijalarni yuklashda xatolik" });
  }
});

// 4. Save a new test result
apiRouter.post("/results", (req, res) => {
  try {
    const { result } = req.body || {};
    if (!result || !result.studentName) {
      return res.status(400).json({ success: false, error: "Natija ma'lumotlari to'liq emas" });
    }
    const saved = storage.addResult(result);
    return res.json({ success: true, result: saved, message: "Test natijasi markaziy serverga saqlandi" });
  } catch (err: any) {
    console.error("Save result error:", err);
    return res.status(500).json({ success: false, error: "Natijani saqlashda xatolik" });
  }
});

// 5. Clear all results
apiRouter.delete("/results", (req, res) => {
  try {
    storage.clearResults();
    return res.json({ success: true, message: "Barcha natijalar tozalandi" });
  } catch (err: any) {
    console.error("Clear results error:", err);
    return res.status(500).json({ success: false, error: "Natijalarni tozalashda xatolik" });
  }
});

// 6. Delete a single result
apiRouter.delete("/results/:id", (req, res) => {
  try {
    const { id } = req.params;
    if (id) {
      storage.deleteResult(id);
    }
    return res.json({ success: true, message: "Natija o'chirildi" });
  } catch (err: any) {
    console.error("Delete result error:", err);
    return res.status(500).json({ success: false, error: "Natijani o'chirishda xatolik" });
  }
});

// 7. Get / Save Delivery Config
apiRouter.get("/delivery-config", (req, res) => {
  try {
    const config = storage.getDeliveryConfig();
    return res.json({ success: true, config });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: "Sozlamalarni olishda xatolik" });
  }
});

apiRouter.post("/delivery-config", (req, res) => {
  try {
    const { config } = req.body || {};
    if (!config) {
      return res.status(400).json({ success: false, error: "Sozlamalar berilmadi" });
    }
    const saved = storage.saveDeliveryConfig(config);
    return res.json({ success: true, config: saved });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: "Sozlamalarni saqlashda xatolik" });
  }
});
