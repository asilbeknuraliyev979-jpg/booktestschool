import * as pdfjsLib from 'pdfjs-dist';

// Use standard CDN worker to guarantee compatibility in all browsers & Vite bundling
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export interface ExtractedPdfResult {
  text: string;
  pageCount: number;
  characterCount: number;
}

/**
 * Extracts text from a PDF file directly inside the browser using Mozilla PDF.js.
 * This completely bypasses Vercel's 4.5MB request payload limit (FUNCTION_PAYLOAD_TOO_LARGE)
 * and allows reading even 50MB - 100MB textbooks and novels instantly.
 */
export async function extractPdfTextInBrowser(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<ExtractedPdfResult> {
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
    pageCount: numPages,
    characterCount: combinedText.length,
  };
}
