import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { PDFParse } from "pdf-parse";
import {
  authenticateAdmin,
  verifySessionToken,
  revokeSessionToken,
  requireAdminAuth,
  applySecurityHeaders,
  createRateLimiter,
  getClientIp,
  sanitizeInput,
} from "./server/security";

const app = express();
const PORT = 3000;

// Apply OWASP Security Headers (prevent XSS, Clickjacking, MIME sniffing)
app.use(applySecurityHeaders);

// Support up to 50MB for uploading PDF files
app.use(express.json({ limit: "50mb" }));

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

// Lazy init GenAI
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ==========================================
// ADMIN AUTHENTICATION ENDPOINTS (SECURE)
// ==========================================

// 1. Admin Login (Username: aistudio, Password: salom7852qaz)
app.post("/api/admin/login", loginRateLimiter, (req, res) => {
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
app.get("/api/admin/verify", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ valid: false });
  }

  const token = authHeader.slice(7).trim();
  const isValid = verifySessionToken(token);
  return res.json({ valid: isValid });
});

// 3. Admin Logout
app.post("/api/admin/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    revokeSessionToken(token);
  }
  return res.json({ success: true, message: "Admin sessiyasi yakunlandi." });
});

// Sleep helper
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: Extract text from PDF buffer
async function extractTextFromPDF(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const parser = new PDFParse({ data: buffer });
  try {
    await parser.load();
    const result = await parser.getText();
    const rawText = typeof result === "string" ? result : result?.text || "";
    const cleanText = rawText.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");
    const pageCount = (typeof result === "object" && result?.total) ? result.total : 1;
    return { text: cleanText, pageCount };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

// 1. PDF Parse endpoint (instant parsing & preview - Admin protected)
app.post("/api/parse-pdf", requireAdminAuth, async (req, res) => {
  try {
    const { pdfBase64 } = req.body;
    if (!pdfBase64) {
      return res.status(400).json({ error: "PDF fayli (base64) yuborilmadi." });
    }

    // Strip data URL header if present (e.g., data:application/pdf;base64,...)
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "").trim();
    const buffer = Buffer.from(base64Data, "base64");

    const { text, pageCount } = await extractTextFromPDF(buffer);

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        error: "PDF faylidan matn ajratib olinmadi. Iltimos skaner qilinmagan, matnli PDF kitob yuklang yoki kitob matnidan nusxa ko'chirib kiriting.",
      });
    }

    return res.json({
      success: true,
      pageCount,
      characterCount: text.length,
      preview: text.slice(0, 1000),
      fullText: text,
    });
  } catch (error: any) {
    console.error("PDF Parse error:", error);
    return res.status(500).json({
      error: error?.message || "PDF faylini o'qishda xatolik yuz berdi.",
    });
  }
});

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

// 2. Professional AI Question Generation API (Admin protected)
app.post("/api/generate-questions", requireAdminAuth, async (req, res) => {
  try {
    const {
      bookTitle,
      author,
      grade,
      bookText,
      pdfBase64,
      multipleChoiceCount = 60,
      writtenCount = 20,
    } = req.body;

    const safeTitle = sanitizeInput(bookTitle, 200);
    const safeAuthor = sanitizeInput(author, 200);
    const safeGrade = sanitizeInput(grade, 100);
    let finalContent = sanitizeInput(bookText || "", 2000000);

    // If PDF was sent and text wasn't provided, extract directly
    if (pdfBase64 && (!finalContent || finalContent.length < 50)) {
      try {
        const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "").trim();
        const buffer = Buffer.from(cleanBase64, "base64");
        const { text } = await extractTextFromPDF(buffer);
        if (text && text.trim().length > 0) {
          finalContent = text.trim();
        }
      } catch (pdfErr) {
        console.warn("Could not extract from PDF buffer in generation:", pdfErr);
      }
    }

    if (!safeTitle) {
      return res.status(400).json({
        error: "Kitob nomi kiritilishi shart.",
      });
    }

    if (!finalContent || finalContent.length < 30) {
      return res.status(400).json({
        error: "Kitob matni yoki PDF fayli kiritilishi shart.",
      });
    }

    const ai = getGenAI();

    // If total questions requested is large (e.g. 80 questions: 60 MC + 20 Written),
    // we split into 2 smart batches to avoid JSON token limits and guarantee all 80 questions!
    const totalCount = Number(multipleChoiceCount) + Number(writtenCount);

    let allMC: any[] = [];
    let allWritten: any[] = [];

    if (totalCount > 35) {
      const halfMC = Math.ceil(Number(multipleChoiceCount) / 2);
      const remainingMC = Number(multipleChoiceCount) - halfMC;
      const halfWritten = Math.ceil(Number(writtenCount) / 2);
      const remainingWritten = Number(writtenCount) - halfWritten;

      const midPoint = Math.floor(finalContent.length / 2);
      const part1 = finalContent.slice(0, Math.min(midPoint + 2000, 35000));
      const part2 = finalContent.slice(Math.max(0, midPoint - 2000), Math.min(finalContent.length, midPoint + 35000));

      // Batch 1: First half of book
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

      // Batch 2: Second half of book
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
      },
    });
  } catch (error: any) {
    console.error("AI Generation error:", error);
    return res.status(500).json({
      error: error?.message || "Savollarni yaratishda xatolik yuz berdi",
    });
  }
});

// 3. AI Written Answers Semantic Evaluation API (Rate limited & sanitized)
app.post("/api/evaluate-written-answers", evaluateRateLimiter, async (req, res) => {
  try {
    const { evaluations, bookTitle } = req.body;
    if (!evaluations || !Array.isArray(evaluations) || evaluations.length === 0) {
      return res.json({ success: true, evaluations: [] });
    }

    const ai = getGenAI();

    // Map to hold evaluation results
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
      const prompt = `Siz maktab o‘quvchilarining bilimini baholovchi mehrli, adolatli va professional adabiyot o‘qituvchisiz.
Quyidagi ro‘yxatdagi o‘quvchining yozma javoblarini kutilgan to‘g‘ri javob bilan solishtiring.
Kitob: "${bookTitle || "Adabiyot asari"}"

O'QUVCHILAR UCHUN PEDAGOGIK BAHOLASHNING ASOSIY QOIDALARI:
1. Agar o‘quvchining javobi to‘g‘ri javobga MAZMUNAN YAQIN bo‘lsa, asar ma'nosi, voqeasi, sababi yoki qahramonning niyatini to‘g‘ri tushungan bo‘lsa, uni ALBATTA TO‘G‘RI deb qabul qiling (isAccepted: true).
2. O‘quvchi o‘z so‘zlari bilan, qisqartirib yoki sinonimlar orqali yozgan bo‘lsa ham, imlo yoki jumlalarda kichik noaniqliklar bo‘lsa ham — agar mazmun to‘g‘ri bo‘lsa, to'g'ri deb baholang!
3. Faqat asarga umuman aloqasi bo‘lmagan, boshqa qahramon yoki asossiz xato ma'lumot berilgan javoblarnigina noto‘g‘ri deb hisoblang (isAccepted: false).
4. Har biriga o‘quvchini ruhlantiruvchi, 1 jumlalik samimiy o'qituvchi izohini bering ("feedback").

Baholanishi kerak bo‘lgan javoblar:
${JSON.stringify(
  itemsToEvaluate.map((i) => ({
    questionId: i.questionId,
    question: i.question,
    expectedAnswer: i.expectedAnswer,
    keywords: i.keywords || [],
    studentAnswer: i.studentAnswer,
  })),
  null,
  2
)}`;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: prompt,
          config: {
            systemInstruction:
              "Siz maktab o'quvchilari uchun mehrli, adolatli o'qituvchisiz. Agar o'quvchining javobi to'g'ri javobga mazmunan yaqin bo'lsa, to'g'ri deb qabul qilasiz (isAccepted: true). Faqat JSON formatda javob bering.",
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
          (parsed.evaluations || []).forEach((ev: any) => {
            resultsMap.set(ev.questionId, {
              isAccepted: !!ev.isAccepted,
              feedback: ev.feedback || (ev.isAccepted ? "Mazmunan to'g'ri javob berilgan." : "Javob to'liq mos kelmadi."),
            });
          });
        }
      } catch (aiErr) {
        console.warn("AI evaluation error, fallback to keyword/substring check:", aiErr);
        // Fallback semantic/keyword heuristic
        itemsToEvaluate.forEach((item) => {
          const cleanStudent = (item.studentAnswer || "").toLowerCase().trim();
          const cleanExpected = (item.expectedAnswer || "").toLowerCase().trim();
          let accepted = false;
          if (cleanExpected.includes(cleanStudent) || cleanStudent.includes(cleanExpected)) {
            accepted = true;
          } else if (item.keywords && Array.isArray(item.keywords)) {
            accepted = item.keywords.some((kw: string) => cleanStudent.includes(kw.toLowerCase().trim()));
          }
          resultsMap.set(item.questionId, {
            isAccepted: accepted,
            feedback: accepted
              ? "Javobingiz to'g'ri javobga mazmunan yaqin deb qabul qilindi."
              : "Javobingiz kutilgan javob bilan to'liq mos kelmadi.",
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

// Start Vite / Static handler
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
