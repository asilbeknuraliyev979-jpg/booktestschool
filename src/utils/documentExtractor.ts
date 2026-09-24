import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Use standard CDN worker to guarantee compatibility in all browsers & Vite bundling
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export interface ExtractedDocumentResult {
  text: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'txt' | 'other';
  pageOrSectionCount?: number;
  characterCount: number;
}

/**
 * Extracts raw text from PDF, Word (.docx), or plain text files in the browser.
 */
export async function extractDocumentText(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<ExtractedDocumentResult> {
  const fileName = file.name;
  const lowerName = fileName.toLowerCase();

  // 1. Plain text / Markdown
  if (lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
    const text = await file.text();
    return {
      text,
      fileName,
      fileType: 'txt',
      characterCount: text.length,
    };
  }

  // 2. Word document (.docx)
  if (lowerName.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value || '';
      return {
        text: text.trim(),
        fileName,
        fileType: 'docx',
        characterCount: text.length,
      };
    } catch (docxErr: any) {
      console.error('Mammoth .docx extraction error:', docxErr);
      throw new Error(`Word (.docx) faylini o'qishda xatolik: ${docxErr?.message || 'Fayl formati mos kelmadi'}`);
    }
  }

  // 3. Old Word document (.doc)
  if (lowerName.endsWith('.doc') || file.type === 'application/msword') {
    // Attempt docx mammoth first, if fails provide clear instruction
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      if (result.value && result.value.trim().length > 20) {
        return {
          text: result.value.trim(),
          fileName,
          fileType: 'docx',
          characterCount: result.value.length,
        };
      }
    } catch {
      // Fallback
    }
    // Attempt text extraction
    const rawBuffer = await file.arrayBuffer();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const decoded = decoder.decode(rawBuffer);
    // Filter printable chunks
    const cleaned = decoded
      .replace(/[^\x20-\x7E\u0400-\u04FF\u0100-\u017F\n\r\t]/g, ' ')
      .replace(/\s{3,}/g, '\n')
      .trim();

    if (cleaned.length > 50) {
      return {
        text: cleaned,
        fileName,
        fileType: 'docx',
        characterCount: cleaned.length,
      };
    }

    throw new Error(
      "Eski .doc formatini o'qib bo'lmadi. Iltimos, faylni Microsoft Word orqali zamonaviy .docx yoki .pdf formatida saqlab, qayta yuklang."
    );
  }

  // 4. PDF file (.pdf)
  if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked: true,
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageString = textContent.items
          .map((item: any) => ('str' in item ? item.str : ''))
          .join(' ');

        if (pageString.trim()) {
          pageTexts.push(pageString.trim());
        }
      } catch (pageErr) {
        console.warn(`Error reading PDF page ${pageNum}:`, pageErr);
      }

      if (onProgress) {
        onProgress(pageNum, numPages);
      }
    }

    const combinedText = pageTexts.join('\n\n').trim();
    return {
      text: combinedText,
      fileName,
      fileType: 'pdf',
      pageOrSectionCount: numPages,
      characterCount: combinedText.length,
    };
  }

  // Default fallback for any other text-like file
  const fallbackText = await file.text();
  return {
    text: fallbackText,
    fileName,
    fileType: 'other',
    characterCount: fallbackText.length,
  };
}
