/**
 * Safe fetch helper that intercepts non-JSON responses (e.g. Vercel 404 HTML, 504 Timeout)
 * and provides clear, actionable error messages instead of SyntaxError crashes.
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);
  const contentType = res.headers.get('content-type') || '';

  let parsedData: any = null;
  let rawText = '';

  if (contentType.includes('application/json')) {
    try {
      parsedData = await res.json();
    } catch {
      // ignore, handled below
    }
  } else {
    rawText = await res.text().catch(() => '');
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        "API manzili topilmadi (404 Not Found). Vercel-da backend serverless sozlanmagan yoki yo'l xato. Vercel sozlamalarida GEMINI_API_KEY mavjudligini va vercel.json borligini tekshiring."
      );
    }

    if (res.status === 504 || res.status === 408) {
      throw new Error(
        "So'rov vaqti tugadi (504 Gateway Timeout). Vercel serverless vaqt limiti oshib ketdi. Savollar sonini kamaytirib qayta urinib ko'ring."
      );
    }

    if (res.status === 413 || rawText.includes('FUNCTION_PAYLOAD_TOO_LARGE') || rawText.includes('Payload Too Large')) {
      throw new Error(
        "Fayl hajmi server limiti (4.5 MB) dan katta (FUNCTION_PAYLOAD_TOO_LARGE). Tizim PDF faylini brauzeringiz orqali bevosita tahlil qilmoqda."
      );
    }

    if (rawText.includes('FUNCTION_INVOCATION_FAILED') || (parsedData?.error && parsedData.error.includes('FUNCTION_INVOCATION_FAILED'))) {
      throw new Error(
        "Vercel Serverless xatoligi (FUNCTION_INVOCATION_FAILED): Serverless funksiya ishga tushishida to'xtab qoldi. Iltimos, Vercel-da GEMINI_API_KEY o'rnatilganligini tekshiring va loyihani oxirgi versiya bilan qayta deploy (Redeploy) qiling."
      );
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        parsedData?.error || "Xavfsizlik: Ruxsat berilmadi (401/403). Admin sessiyasi eskirgan, iltimos qaytadan kiring."
      );
    }

    const message =
      parsedData?.error ||
      (rawText && rawText.length < 200 ? rawText : `Server xatoligi yuz berdi (${res.status})`);

    throw new Error(message);
  }

  if (!parsedData) {
    if (rawText.startsWith('<!DOCTYPE html>') || rawText.startsWith('<html') || rawText.includes('The page c')) {
      throw new Error(
        "Server JSON o'rniga HTML sahifa qaytardi. Vercel-da API yo'li (/api/...) serverless funksiyaga yo'naltirilmagan yoki GEMINI_API_KEY o'rnatilmagan."
      );
    }
    throw new Error("Serverdan noto'g'ri formatdagi javob qaytdi.");
  }

  return parsedData as T;
}
