import { Question } from '../types';
import { sanitizeQuestionToLatin } from './transliterate';

/**
 * Intelligent Parser for Google NotebookLM & External AI Quiz Text
 * 
 * Supports varied formats:
 * 1. Question with A) B) C) D) options and Answer / Javob
 * 2. Written questions with Expected Answer and Keywords
 */
export function parseExternalQuizText(rawText: string): {
  multipleChoiceQuestions: Question[];
  writtenQuestions: Question[];
} {
  const mcQuestions: Question[] = [];
  const writtenQuestions: Question[] = [];

  if (!rawText || !rawText.trim()) {
    return { multipleChoiceQuestions: [], writtenQuestions: [] };
  }

  // Normalize line breaks
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into candidate question blocks by number (e.g. "1.", "1)", "Savol 1:") or double newline
  const blocks = normalized
    .split(/\n(?=(?:[0-9]{1,3}[.)]|[QqSs]avol\s*[0-9]{1,3}[:.)]|#{1,3}\s*[0-9]{1,3}))/g)
    .map((b) => b.trim())
    .filter((b) => b.length > 15);

  blocks.forEach((block, idx) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    // Detect if this is a written question
    const isWritten =
      lines.some((l) => /^(?:yozma|ochiq|free[- ]?response|insho)/i.test(l)) ||
      (!lines.some((l) => /^[A-D][.)\s]/i.test(l)) &&
        lines.some((l) => /^(?:javob|etalon|expected|kalit|keywords?)/i.test(l)));

    if (isWritten) {
      let qText = lines[0].replace(/^(?:[0-9]{1,3}[.)]|[QqSs]avol\s*[0-9]{1,3}[:.)]\s*|#{1,3}\s*|\*{1,2})/g, '').trim();
      let expectedAns = '';
      const kwList: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (/^(?:to'g'ri\s+javob|javob|etalon|expected\s*answer?)[:\s]/i.test(line)) {
          expectedAns = line.replace(/^(?:to'g'ri\s+javob|javob|etalon|expected\s*answer?)[:\s]*/i, '').trim();
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
      // Multiple Choice question
      let qText = '';
      const options: string[] = [];
      let correctIdx = 0;
      let explanation = '';

      lines.forEach((line) => {
        const optMatch = line.match(/^([A-Da-d])[.)\s]\s*(.*)$/);
        const ansMatch = line.match(/^(?:to'g'ri\s+javob|javob|answer|to'g'ri\s*variant)[:\s]*([A-Da-d])/i);
        const explMatch = line.match(/^(?:izoh|tushuntirish|explanation)[:\s]*(.*)$/i);

        if (ansMatch) {
          const letter = ansMatch[1].toUpperCase();
          correctIdx = letter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
        } else if (explMatch) {
          explanation = explMatch[1].trim();
        } else if (optMatch) {
          options.push(optMatch[2].trim());
        } else if (options.length === 0) {
          const cleanLine = line.replace(/^(?:[0-9]{1,3}[.)]|[QqSs]avol\s*[0-9]{1,3}[:.)]\s*|#{1,3}\s*|\*{1,2})/g, '').trim();
          qText = qText ? `${qText} ${cleanLine}` : cleanLine;
        }
      });

      if (options.length >= 2 && qText) {
        // Pad options if fewer than 4
        while (options.length < 4) {
          options.push(`Qo'shimcha variant ${options.length + 1}`);
        }

        mcQuestions.push({
          id: `mc-imported-${Date.now()}-${idx}`,
          type: 'multiple-choice',
          question: qText.replace(/^\*+|\*+$/g, '').trim(),
          options: options.slice(0, 4),
          correctOptionIndex: correctIdx >= 0 && correctIdx < 4 ? correctIdx : 0,
          explanation: explanation || "Google NotebookLM manba matnidan olingan aniq fakt.",
        });
      }
    }
  });

  return {
    multipleChoiceQuestions: mcQuestions.map((q) => sanitizeQuestionToLatin(q)),
    writtenQuestions: writtenQuestions.map((q) => sanitizeQuestionToLatin(q)),
  };
}
