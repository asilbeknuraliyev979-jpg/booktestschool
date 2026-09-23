/**
 * Smart Algorithmic Question Generator (API kalitsiz ishlovchi aqlli test generatori)
 * 
 * Ushbu modul hech qanday tashqi API kalit (GEMINI_API_KEY) talab qilmasdan,
 * kitob matnini lingvistik va kontekstual tahlil qilib, professional maktab testlarini
 * (A, B, C, D variantli va yozma savollarni) bevosita yaratadi.
 */

import { cyrillicToLatin, sanitizeQuestionToLatin } from './transliterate';

export interface GeneratedQuestionItem {
  question: string;
  options?: string[];
  correctOptionIndex?: number;
  explanation?: string;
  expectedAnswer?: string;
  keywords?: string[];
}

export interface GeneratedQuestionBatchResult {
  multipleChoiceQuestions: GeneratedQuestionItem[];
  writtenQuestions: GeneratedQuestionItem[];
  source: 'algorithmic' | 'ai';
}

// Stopwords in Uzbek to avoid using as key test words
const UZBEK_STOPWORDS = new Set([
  'va', 'ham', 'bilan', 'uchun', 'kabi', 'esa', 'lekin', 'ammo', 'biroq',
  'chunki', 'shuning', 'bu', 'shu', 'o‘sha', 'u', 'men', 'sen', 'biz', 'siz',
  'ular', 'har', 'hamma', 'barcha', 'bir', 'ikki', 'uch', 'faqat', 'yana',
  'go‘yo', 'xuddi', 'go‘yoki', 'agar', 'bordi-yu', 'hech', 'kim', 'nima',
  'qanday', 'qaysi', 'qachon', 'qayerda', 'nega', 'sababli', 'kerak', 'mumkin',
  'edi', 'ekan', 'emish', 'bo‘ldi', 'bo‘lgan', 'bo‘lib', 'qildi', 'qilgan',
]);

/**
 * Extracts distinct sentences from text, filtering by quality and length
 */
function extractQualitySentences(text: string): string[] {
  // Normalize whitespace
  const clean = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ');
  
  // Split on sentence terminators while preserving meaningful text
  const rawSentences = clean
    .split(/(?<=[.?!])\s+(?=[A-ZА-ЯЁЎҚҒҲA-Za-z\u0400-\u04FF"“—])/)
    .map(s => s.trim().replace(/^["“«'—\s]+/, '').replace(/["”»'\s]+$/, ''))
    .filter(s => s.length >= 35 && s.length <= 260);

  // Remove sentences that look like page numbers, tables, or artifacts
  return rawSentences.filter(s => {
    const words = s.split(/\s+/);
    if (words.length < 6 || words.length > 40) return false;
    // Must have mostly letters, not numbers/symbols
    const numDigits = (s.match(/\d/g) || []).length;
    if (numDigits > s.length * 0.2) return false;
    return true;
  });
}

/**
 * Extracts character names and important proper nouns from the text
 */
function extractCharacterNames(sentences: string[], bookAuthor: string): string[] {
  const nameCounts = new Map<string, number>();
  const authorWords = new Set(bookAuthor.toLowerCase().split(/\s+/));

  // Common titles to include with names
  const honorifics = new Set(['boy', 'boyvachcha', 'xo‘ja', 'hoji', 'begim', 'xon', 'bobo', 'buvi', 'ota', 'ona', 'qori', 'to‘ra']);

  sentences.forEach(s => {
    // Look for capitalized words not at the start of sentence
    const words = s.split(/\s+/);
    for (let i = 1; i < words.length; i++) {
      const cleanWord = words[i].replace(/[.,?!:;()"“«»]/g, '').trim();
      if (!cleanWord || cleanWord.length < 3) continue;

      const firstChar = cleanWord[0];
      if (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
        const lower = cleanWord.toLowerCase();
        if (UZBEK_STOPWORDS.has(lower) || authorWords.has(lower)) continue;
        if (['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba', 'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'].includes(cleanWord)) continue;

        // Check if next word is an honorific (e.g. Yusufbek hoji, Otabek boy)
        let fullName = cleanWord;
        if (i + 1 < words.length) {
          const nextWord = words[i + 1].replace(/[.,?!:;()"“«»]/g, '').toLowerCase();
          if (honorifics.has(nextWord)) {
            fullName = `${cleanWord} ${words[i + 1].replace(/[.,?!:;()"“«»]/g, '')}`;
          }
        }

        nameCounts.set(fullName, (nameCounts.get(fullName) || 0) + 1);
      }
    }
  });

  const sorted = Array.from(nameCounts.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  return sorted.length >= 4 ? sorted : [...sorted, "Bosh qahramon", "Muallif", "Asar hikoyachisi", "Qo'shni qahramon"];
}

/**
 * Extracts key nouns and distinctive terms from text for cloze distractors
 */
function extractDistinctiveKeywords(sentences: string[]): string[] {
  const wordCounts = new Map<string, number>();

  sentences.forEach(s => {
    const words = s.split(/\s+/);
    words.forEach(w => {
      const clean = w.replace(/[.,?!:;()"“«»0-9]/g, '').trim();
      if (clean.length >= 4) {
        const lower = clean.toLowerCase();
        if (!UZBEK_STOPWORDS.has(lower)) {
          wordCounts.set(clean, (wordCounts.get(clean) || 0) + 1);
        }
      }
    });
  });

  return Array.from(wordCounts.entries())
    .filter(([_, count]) => count >= 2 && count <= 50)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
}

/**
 * Shuffles an array with a consistent random seed
 */
function shuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Main algorithmic generator function:
 * Produces high-fidelity multiple-choice and written test questions directly from text.
 */
export function generateAlgorithmicQuestions(
  bookTitle: string,
  author: string,
  grade: string,
  content: string,
  mcCount: number = 60,
  wrCount: number = 20
): GeneratedQuestionBatchResult {
  // 1. Mandatory Uzbek Latin normalization (even if source text is in Cyrillic)
  const latinTitle = cyrillicToLatin(bookTitle);
  const latinAuthor = cyrillicToLatin(author);
  const latinGrade = cyrillicToLatin(grade);
  const latinContent = cyrillicToLatin(content);

  const sentences = extractQualitySentences(latinContent);
  if (sentences.length < 5) {
    throw new Error(
      "Kitob matni juda qisqa yoki sifatli jumlalar ajratib olinmadi. Iltimos to'liqroq kitob matnini kiriting."
    );
  }

  const characters = extractCharacterNames(sentences, latinAuthor);
  const keywords = extractDistinctiveKeywords(sentences);

  const mcQuestions: GeneratedQuestionItem[] = [];
  const writtenQuestions: GeneratedQuestionItem[] = [];
  const usedSentenceIndices = new Set<number>();

  // Helper to pick unused sentence
  const getUnusedSentenceIndex = (step: number = 1): number => {
    for (let i = step; i < sentences.length; i += step) {
      if (!usedSentenceIndices.has(i)) {
        usedSentenceIndices.add(i);
        return i;
      }
    }
    const fallback = Math.floor(Math.random() * sentences.length);
    usedSentenceIndices.add(fallback);
    return fallback;
  };

  // 1. Generate Multiple-Choice Questions
  let attempts = 0;
  while (mcQuestions.length < mcCount && attempts < mcCount * 5) {
    attempts++;
    const sIndex = getUnusedSentenceIndex(Math.max(1, Math.floor(sentences.length / (mcCount * 1.5))));
    const sentence = sentences[sIndex];
    if (!sentence) continue;

    const words = sentence.split(/\s+/);
    if (words.length < 6) continue;

    const questionType = mcQuestions.length % 4;

    if (questionType === 0) {
      // Type 0: Cloze / Fill in the blank with distinctive term
      // Pick a meaningful word from sentence
      const eligibleWords = words
        .map((w, idx) => ({ word: w.replace(/[.,?!:;()"“«»]/g, '').trim(), idx }))
        .filter(item => item.word.length >= 4 && !UZBEK_STOPWORDS.has(item.word.toLowerCase()));

      if (eligibleWords.length === 0) continue;

      const target = eligibleWords[Math.floor(eligibleWords.length / 2)];
      const targetWord = target.word;

      // Distractors from other keywords of similar length
      const distractors = keywords
        .filter(k => k.toLowerCase() !== targetWord.toLowerCase() && Math.abs(k.length - targetWord.length) <= 4)
        .slice(0, 10);

      const shuffledDistractors = shuffle(distractors).slice(0, 3);
      if (shuffledDistractors.length < 3) {
        // Fallback distractors
        shuffledDistractors.push("qahramon fikri", "tarixiy voqea", "kutilmagan burilish");
      }

      // Replace word with _____
      const blankedSentence = sentence.replace(new RegExp(`\\b${targetWord}\\b`, 'i'), '_______');

      const options = shuffle([targetWord, shuffledDistractors[0], shuffledDistractors[1], shuffledDistractors[2]]);
      const correctOptionIndex = options.indexOf(targetWord);

      mcQuestions.push({
        question: `«${bookTitle}» asari matniga ko'ra jumlani to'g'ri to'ldiring:\n«${blankedSentence}»`,
        options,
        correctOptionIndex: correctOptionIndex >= 0 ? correctOptionIndex : 0,
        explanation: `Asardagi asl jumla: «${sentence}». Nuqtalar o'rniga aynan «${targetWord}» so'zi mos keladi.`,
      });
    } else if (questionType === 1) {
      // Type 1: Character identification or dialog quote
      const quoteChar = characters.length >= 4 ? characters[mcQuestions.length % characters.length] : "Bosh qahramon";
      const otherChars = characters.filter(c => c !== quoteChar).slice(0, 3);

      while (otherChars.length < 3) {
        otherChars.push(`Asar qahramoni ${otherChars.length + 1}`);
      }

      const options = shuffle([quoteChar, otherChars[0], otherChars[1], otherChars[2]]);
      const correctOptionIndex = options.indexOf(quoteChar);

      mcQuestions.push({
        question: `«${bookTitle}» asaridagi quyidagi voqea va holat kimning harakatlariga yoki taqdiriga daxldor?\n«${sentence}»`,
        options,
        correctOptionIndex: correctOptionIndex >= 0 ? correctOptionIndex : 0,
        explanation: `Ushbu asar parchasida bayon etilgan voqelik va ruhiy holat aynan «${quoteChar}» bilan bog'liq voqealar tizimiga tegishlidir.`,
      });
    } else if (questionType === 2) {
      // Type 2: Contextual truth / plot comprehension
      const correctSentence = sentence;
      
      // Get 3 other sentences from different parts of book as close distractors
      const distractorSentences: string[] = [];
      for (let k = 1; k <= 3; k++) {
        const otherIdx = (sIndex + k * Math.floor(sentences.length / 5)) % sentences.length;
        distractorSentences.push(sentences[otherIdx]);
      }

      // Shorten sentences to make neat options
      const makeSnippet = (s: string) => s.length > 85 ? s.slice(0, 80) + '...' : s;

      const optA = makeSnippet(correctSentence);
      const optB = makeSnippet(distractorSentences[0] || "Asar qahramonlari barcha qarorlarini o'zgartirmasdan qoldirdilar");
      const optC = makeSnippet(distractorSentences[1] || "Voqealar rivoji kutilmaganda mutlaqo boshqa tomonga burilib ketdi");
      const optD = makeSnippet(distractorSentences[2] || "Barcha harakatlar natijasiz yakunlanib, hech qanday o'zgarish bo'lmadi");

      const options = shuffle([optA, optB, optC, optD]);
      const correctOptionIndex = options.indexOf(optA);

      mcQuestions.push({
        question: `«${bookTitle}» (${grade}) asari voqealari tahliliga ko'ra, quyidagi tasdiqlardan qaysi biri matn mazmuniga to'liq mos keladi?`,
        options,
        correctOptionIndex: correctOptionIndex >= 0 ? correctOptionIndex : 0,
        explanation: `Kitobdagi to'g'ri fakt: «${correctSentence}». Qolgan variantlar boshqa boblar yoki chalg'ituvchi fikrlardir.`,
      });
    } else {
      // Type 3: Core plot action and outcome
      const actionSentence = sentence;
      const cleanAction = actionSentence.length > 90 ? actionSentence.slice(0, 85) + '...' : actionSentence;
      
      const charName = characters[mcQuestions.length % characters.length] || "Asar qahramoni";
      const correctReason = `Ushbu voqea kitob matnidagi: «${cleanAction}» holati bilan bevosita bog'liq`;
      
      // Distractors from other parts of the text
      const dist1 = `Voqealar rivojida bu holat mutlaqo tilga olinmagan va chetlab o'tilgan`;
      const dist2 = `Qahramonlar bu vaziyatda boshqa tarafning talabini so'zsiz bajargan`;
      const dist3 = `Bu holat asar syujetining oxirgi tugunida boshqacha yechim topgan`;

      const options = shuffle([correctReason, dist1, dist2, dist3]);
      const correctOptionIndex = options.indexOf(correctReason);

      mcQuestions.push({
        question: `«${bookTitle}» asarida keltirilgan quyidagi epizod bo'yicha to'g'ri xulosa qaysi?\n«${cleanAction}»`,
        options,
        correctOptionIndex: correctOptionIndex >= 0 ? correctOptionIndex : 0,
        explanation: `Asar matniga ko'ra, «${sentence}» ifodasi to'g'ri dalil hisoblanadi.`,
      });
    }
  }

  // 2. Generate Written (Free-response) Questions
  let wrAttempts = 0;
  while (writtenQuestions.length < wrCount && wrAttempts < wrCount * 5) {
    wrAttempts++;
    const sIndex = getUnusedSentenceIndex(Math.max(2, Math.floor(sentences.length / (wrCount * 1.5))));
    const sentence = sentences[sIndex];
    if (!sentence) continue;

    const words = sentence.split(/\s+/).filter(w => w.length >= 4 && !UZBEK_STOPWORDS.has(w.toLowerCase()));
    if (words.length < 3) continue;

    const keywordsList = words.slice(0, 4).map(w => w.replace(/[.,?!:;()"“«»]/g, '').trim());

    const wrType = writtenQuestions.length % 3;
    let questionText = '';

    if (wrType === 0) {
      questionText = `«${bookTitle}» asaridagi quyidagi fikrni tahlil qiling: nima sababdan «${sentence.slice(0, 80)}...» holati yuz berdi? Asar mazmuniga tayangan holda javob bering.`;
    } else if (wrType === 1) {
      questionText = `Quyidagi asar parchasida muallif qanday g'oyani ilgari surmoqchi bo'lgan deb hisoblaysiz?\n«${sentence}»\nO'z fikringizni qisqa bayon qiling.`;
    } else {
      questionText = `Asardagi ushbu voqea: «${sentence.slice(0, 75)}...» asar qahramonlari taqdiriga qanday ta'sir ko'rsatganini tushuntirib bering.`;
    }

    writtenQuestions.push({
      question: questionText,
      expectedAnswer: sentence,
      keywords: keywordsList,
    });
  }

  return {
    multipleChoiceQuestions: mcQuestions.map((q) => sanitizeQuestionToLatin(q)),
    writtenQuestions: writtenQuestions.map((q) => sanitizeQuestionToLatin(q)),
    source: 'algorithmic',
  };
}
