/**
 * Official Uzbek Cyrillic to Latin Transliteration Utility
 * Adheres to standard Uzbek orthography.
 */

const CYRILLIC_TO_LATIN_MAP: Record<string, string> = {
  А: "A", а: "a",
  Б: "B", б: "b",
  В: "V", в: "v",
  Г: "G", г: "g",
  Д: "D", д: "d",
  Ж: "J", ж: "j",
  З: "Z", з: "z",
  И: "I", и: "i",
  Й: "Y", й: "y",
  К: "K", к: "k",
  Л: "L", л: "l",
  М: "M", м: "m",
  Н: "N", н: "n",
  О: "O", о: "o",
  П: "P", п: "p",
  Р: "R", р: "r",
  С: "S", с: "s",
  Т: "T", т: "t",
  У: "U", у: "u",
  Ф: "F", ф: "f",
  Х: "X", х: "x",
  Ҳ: "H", ҳ: "h",
  Қ: "Q", қ: "q",
  Ғ: "G'", ғ: "g'",
  Ў: "O'", ў: "o'",
  Ч: "Ch", ч: "ch",
  Ш: "Sh", ш: "sh",
  Щ: "Sh", щ: "sh",
  Ъ: "'", ъ: "'",
  Ь: "", ь: "",
  Ы: "I", ы: "i",
  Э: "E", э: "e",
  Ю: "Yu", ю: "yu",
  Я: "Ya", я: "ya",
  Ё: "Yo", ё: "yo",
};

const VOWELS_CYRILLIC = new Set([
  'а', 'е', 'ё', 'и', 'о', 'у', 'э', 'ю', 'я', 'ў',
  'А', 'Е', 'Ё', 'И', 'О', 'У', 'Э', 'Ю', 'Я', 'Ў'
]);

/**
 * Converts a text string from Uzbek Cyrillic to standard Uzbek Latin script.
 * Handles contextual 'Е/е' (ye at word-start / after vowel, e after consonant)
 * and 'Ц/ц' (ts).
 */
export function cyrillicToLatin(text: string): string {
  if (!text) return '';

  let result = '';
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : ' ';
    const nextChar = i < len - 1 ? text[i + 1] : ' ';

    // Handle 'Е' / 'е'
    if (char === 'Е') {
      const isWordStart = i === 0 || /[\s\p{P}]/u.test(prevChar);
      const isAfterVowel = VOWELS_CYRILLIC.has(prevChar);
      const isNextUpper = /[А-ЯЁЎҒҚҲ]/.test(nextChar);
      if (isWordStart || isAfterVowel) {
        result += isNextUpper ? 'YE' : 'Ye';
      } else {
        result += 'E';
      }
      continue;
    }
    if (char === 'е') {
      const isWordStart = i === 0 || /[\s\p{P}]/u.test(prevChar);
      const isAfterVowel = VOWELS_CYRILLIC.has(prevChar);
      result += (isWordStart || isAfterVowel) ? 'ye' : 'e';
      continue;
    }

    // Handle 'Ц' / 'ц'
    if (char === 'Ц') {
      const isNextUpper = /[А-ЯЁЎҒҚҲ]/.test(nextChar);
      result += isNextUpper ? 'TS' : 'Ts';
      continue;
    }
    if (char === 'ц') {
      result += 'ts';
      continue;
    }

    // Direct mapped Cyrillic character
    if (CYRILLIC_TO_LATIN_MAP[char] !== undefined) {
      result += CYRILLIC_TO_LATIN_MAP[char];
      continue;
    }

    // Preserve non-Cyrillic characters (Latin, punctuation, numbers, emojis)
    result += char;
  }

  // Clean double apostrophes if any
  return result
    .replace(/[ʻʼ`´]/g, "'")
    .replace(/''+/g, "'");
}

/**
 * Checks if a string contains significant Uzbek Cyrillic letters
 */
export function hasCyrillic(text: string): boolean {
  return /[а-яёўқғҳА-ЯЁЎҒҚҲ]/.test(text);
}

/**
 * Sanitizes an entire Question object so all text fields are in Uzbek Latin
 */
export function sanitizeQuestionToLatin<T extends {
  question: string;
  options?: string[];
  explanation?: string;
  expectedAnswer?: string;
  keywords?: string[];
}>(q: T): T {
  return {
    ...q,
    question: cyrillicToLatin(q.question),
    ...(q.options ? { options: q.options.map((opt) => cyrillicToLatin(opt)) } : {}),
    ...(q.explanation ? { explanation: cyrillicToLatin(q.explanation) } : {}),
    ...(q.expectedAnswer ? { expectedAnswer: cyrillicToLatin(q.expectedAnswer) } : {}),
    ...(q.keywords ? { keywords: q.keywords.map((kw) => cyrillicToLatin(kw)) } : {}),
  };
}
