import { Question } from '../types';
import { cyrillicToLatin, sanitizeQuestionToLatin } from './transliterate';

export interface ParseResult {
  multipleChoiceQuestions: Question[];
  writtenQuestions: Question[];
  totalParsed: number;
  detectedFormat: string;
}

/**
 * Intelligent Parser for Word (.docx / .doc), PDF, and NotebookLM test documents.
 * Specially tuned for teacher question banks, DTM tests, and school literature tests in Uzbekistan.
 */
export function parseExternalQuizText(rawText: string): ParseResult {
  if (!rawText || !rawText.trim()) {
    return {
      multipleChoiceQuestions: [],
      writtenQuestions: [],
      totalParsed: 0,
      detectedFormat: 'Bo\'sh matn',
    };
  }

  // 1. Normalize line endings and characters
  let text = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u2018\u2019`ʻʼ]/g, "'");

  // 2. Extract global Answer Key at the end if present (e.g. "Javoblar: 1-A, 2-B, 3-C" or "Kalitlar: 1.A 2.B 3.C")
  const answerKeyMap = new Map<number, number>(); // questionNumber -> 0, 1, 2, 3
  const keySectionRegex = /(?:javoblar\s*(?:kaliti|jadvali)?|kalitlar|to'g'ri\s*javoblar|answers?\s*key)[:\s]+([\s\S]*?)$/i;
  const keyMatch = text.match(keySectionRegex);

  if (keyMatch) {
    const rawKeys = keyMatch[1];
    // Find all pairs like "1-A", "1. A", "1:A", "1) A", "1 A"
    const pairRegex = /(?:(\d{1,3})\s*[-.:)]\s*([A-Da-dА-Да-д])|([A-Da-dА-Да-д])\s*[-.:)]\s*(\d{1,3}))/g;
    let m;
    while ((m = pairRegex.exec(rawKeys)) !== null) {
      const qNum = parseInt(m[1] || m[4], 10);
      const letter = (m[2] || m[3]).toUpperCase();
      let optIdx = 0;
      if (letter === 'A' || letter === 'А') optIdx = 0;
      else if (letter === 'B' || letter === 'В') optIdx = 1;
      else if (letter === 'C' || letter === 'С') optIdx = 2;
      else if (letter === 'D' || letter === 'Д') optIdx = 3;
      answerKeyMap.set(qNum, optIdx);
    }

    // Strip key section from question text to prevent false questions
    text = text.substring(0, keyMatch.index).trim();
  }

  // 3. Pre-process inline horizontal options like "A) test   B) test   C) test   D) test"
  // Expand them onto individual lines so parser treats them uniformly
  text = text.replace(
    /([A-Da-dА-Да-д][.)\s]\s*[^A-Da-d\n]+?)\s{2,}(?=[B-Db-dВ-Дв-д][.)\s])/g,
    '$1\n'
  );

  // 4. Split into candidate question blocks by number (e.g. "1.", "1)", "1 - ", "Savol 1:", "№ 1.")
  const questionSplitter = /\n(?=(?:[0-9]{1,3}\s*[.)\-]|№\s*[0-9]{1,3}|[QqSs]avol\s*[0-9]{1,3}[:.)\-]|#{1,3}\s*[0-9]{1,3}))/g;
  let blocks = text
    .split(questionSplitter)
    .map((b) => b.trim())
    .filter((b) => b.length > 10);

  // If question splitter found nothing, try double newlines
  if (blocks.length <= 1) {
    blocks = text
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter((b) => b.length > 15);
  }

  const mcQuestions: Question[] = [];
  const writtenQuestions: Question[] = [];

  blocks.forEach((block, idx) => {
    const rawLines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (rawLines.length === 0) return;

    // Extract Question Number if present
    const firstLine = rawLines[0];
    const numMatch = firstLine.match(/^(?:[QqSs]avol\s*|№\s*)?([0-9]{1,3})\s*[:.)\-]\s*(.*)$/);
    const questionNumber = numMatch ? parseInt(numMatch[1], 10) : idx + 1;

    // Detect if this is explicitly a written / open-ended question
    const isWritten =
      rawLines.some((l) => /^(?:yozma|ochiq|insho|free[- ]?response|esse)/i.test(l)) ||
      (!rawLines.some((l) => /^[+*]?[A-Da-dА-Да-д][.)\s*+]/i.test(l)) &&
        rawLines.some((l) => /^(?:kutilayotgan\s*javob|to'g'ri\s*javob|javob|etalon|kalit\s*so'zlar)/i.test(l)));

    if (isWritten) {
      let qText = (numMatch ? numMatch[2] : firstLine)
        .replace(/^(?:yozma|ochiq|savol[:\s]*)/i, '')
        .trim();
      let expectedAns = '';
      const kwList: string[] = [];

      for (let i = 1; i < rawLines.length; i++) {
        const line = rawLines[i];
        if (/^(?:to'g'ri\s+javob|kutilayotgan\s*javob|javob|etalon|expected\s*answer?)[:\s]/i.test(line)) {
          expectedAns = line.replace(/^(?:to'g'ri\s+javob|kutilayotgan\s*javob|javob|etalon|expected\s*answer?)[:\s]*/i, '').trim();
        } else if (/^(?:kalit\s*so'zlar|keywords?)[:\s]/i.test(line)) {
          const rawKw = line.replace(/^(?:kalit\s*so'zlar|keywords?)[:\s]*/i, '').trim();
          rawKw.split(/[,;]/).forEach((k) => {
            const clean = k.trim();
            if (clean) kwList.push(clean);
          });
        } else if (!expectedAns) {
          qText += ' ' + line;
        }
      }

      if (qText) {
        writtenQuestions.push({
          id: `w-imported-${Date.now()}-${idx}`,
          type: 'written',
          question: qText.replace(/^\*+|\*+$/g, '').trim(),
          expectedAnswer: expectedAns || "Matn asosidagi to'g'ri javob",
          keywords: kwList.length > 0 ? kwList : [qText.split(/\s+/)[0] || 'javob'],
        });
      }
    } else {
      // Multiple Choice Question
      let qText = numMatch ? numMatch[2] : '';
      const options: string[] = [];
      let detectedCorrectIdx: number | null = null;
      let explanation = '';

      const lines = numMatch ? rawLines.slice(1) : rawLines;

      for (const line of lines) {
        // Check for marked option (e.g. "+A) Variant", "*A) Variant", "A)* Variant", "[X] A) Variant")
        const markedOptMatch = line.match(/^(?:\[[xX*+]\]|\+|\*)\s*([A-Da-dА-Да-д])[.)\s]\s*(.*)$/);
        const normalOptMatch = line.match(/^([A-Da-dА-Да-д])[.)\s*+]\s*(.*)$/);
        const ansMatch = line.match(/^(?:to'g'ri\s+javob|javob|kalit|answer|to'g'ri\s*variant)[:\s]*([A-Da-dА-Да-д])/i);
        const explMatch = line.match(/^(?:izoh|tushuntirish|farqi|explanation)[:\s]*(.*)$/i);

        if (markedOptMatch) {
          const letter = markedOptMatch[1].toUpperCase();
          let optIdx = 0;
          if (letter === 'A' || letter === 'А') optIdx = 0;
          else if (letter === 'B' || letter === 'В') optIdx = 1;
          else if (letter === 'C' || letter === 'С') optIdx = 2;
          else if (letter === 'D' || letter === 'Д') optIdx = 3;
          detectedCorrectIdx = optIdx;
          options.push(markedOptMatch[2].trim());
        } else if (normalOptMatch) {
          // Check if end of line has an asterisk or plus or (to'g'ri)
          const isLineMarked = /[*+]|\(to'g'ri\)$/i.test(line);
          if (isLineMarked) {
            detectedCorrectIdx = options.length;
          }
          const optContent = normalOptMatch[2].replace(/[*+]|\(to'g'ri\)$/i, '').trim();
          options.push(optContent);
        } else if (ansMatch) {
          const letter = ansMatch[1].toUpperCase();
          if (letter === 'A' || letter === 'А') detectedCorrectIdx = 0;
          else if (letter === 'B' || letter === 'В') detectedCorrectIdx = 1;
          else if (letter === 'C' || letter === 'С') detectedCorrectIdx = 2;
          else if (letter === 'D' || letter === 'Д') detectedCorrectIdx = 3;
        } else if (explMatch) {
          explanation = explMatch[1].trim();
        } else if (options.length === 0) {
          // Still part of question stem
          const cleanLine = line.replace(/^(?:[0-9]{1,3}[.)]|[QqSs]avol\s*[0-9]{1,3}[:.)]\s*|#{1,3}\s*|\*{1,2})/g, '').trim();
          qText = qText ? `${qText} ${cleanLine}` : cleanLine;
        }
      }

      // Check if global answer key map has this question number
      if (detectedCorrectIdx === null && answerKeyMap.has(questionNumber)) {
        detectedCorrectIdx = answerKeyMap.get(questionNumber)!;
      }

      if (qText && options.length >= 2) {
        // Pad options to 4 if only 2 or 3 are present
        while (options.length < 4) {
          options.push(`Qo'shimcha variant ${options.length + 1}`);
        }

        const finalCorrectIdx =
          detectedCorrectIdx !== null && detectedCorrectIdx >= 0 && detectedCorrectIdx < 4
            ? detectedCorrectIdx
            : 0;

        mcQuestions.push({
          id: `mc-imported-${Date.now()}-${idx}`,
          type: 'multiple-choice',
          question: qText.replace(/^\*+|\*+$/g, '').trim(),
          options: options.slice(0, 4),
          correctOptionIndex: finalCorrectIdx,
          explanation: explanation || "Hujjatdan import qilingan rasmiy savol va to'g'ri javob.",
        });
      } else if (qText && options.length === 0 && qText.length > 15) {
        // Fallback: If it looked like a question with no options, treat as open-ended written question
        writtenQuestions.push({
          id: `w-imported-${Date.now()}-${idx}`,
          type: 'written',
          question: qText.trim(),
          expectedAnswer: "O'quvchi tomonidan to'liq javob yozilishi kutiladi.",
          keywords: [qText.split(/\s+/)[0] || 'javob'],
        });
      }
    }
  });

  const finalMC = mcQuestions.map((q) => sanitizeQuestionToLatin(q));
  const finalWr = writtenQuestions.map((q) => sanitizeQuestionToLatin(q));

  return {
    multipleChoiceQuestions: finalMC,
    writtenQuestions: finalWr,
    totalParsed: finalMC.length + finalWr.length,
    detectedFormat:
      finalMC.length > 0 && finalWr.length > 0
        ? 'Aralash test (Variantli + Yozma)'
        : finalMC.length > 0
        ? 'Variantli testlar (A, B, C, D)'
        : finalWr.length > 0
        ? 'Yozma va ochiq savollar'
        : 'Noma\'lum format',
  };
}
