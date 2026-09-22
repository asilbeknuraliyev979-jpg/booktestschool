import * as XLSX from 'xlsx';
import { StudentTestResult } from '../types';

export function exportResultsToExcel(results: StudentTestResult[], bookTitleFilter?: string) {
  const filtered = bookTitleFilter
    ? results.filter((r) => r.bookTitle === bookTitleFilter)
    : results;

  if (filtered.length === 0) {
    alert("Yuklab olish uchun natijalar mavjud emas!");
    return;
  }

  // 1. O'quvchilar natijalari varag'i (Student Results Sheet)
  const rows = filtered.map((r, index) => ({
    "T/r": index + 1,
    "O'quvchi F.I.Sh": r.studentName,
    "Sinf": r.studentGrade,
    "Kitob nomi": r.bookTitle,
    "Ball": `${r.score} / ${r.totalQuestions}`,
    "Foiz (%)": `${r.percentage}%`,
    "Baho": r.gradeBadge,
    "Variantli to'g'ri": `${r.multipleChoiceCorrect} / ${r.multipleChoiceTotal}`,
    "Yozma to'g'ri": `${r.writtenCorrect} / ${r.writtenTotal}`,
    "Sarflangan vaqt (daq)": `${Math.floor(r.durationSeconds / 60)} daq ${r.durationSeconds % 60} son`,
    "Topshirilgan vaqt": new Date(r.completedAt).toLocaleString('uz-UZ'),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Ustunlar kengligini belgilash (Set column widths)
  worksheet['!cols'] = [
    { wch: 6 },  // T/r
    { wch: 25 }, // O'quvchi
    { wch: 10 }, // Sinf
    { wch: 25 }, // Kitob
    { wch: 12 }, // Ball
    { wch: 10 }, // Foiz
    { wch: 15 }, // Baho
    { wch: 18 }, // Variantli
    { wch: 16 }, // Yozma
    { wch: 20 }, // Vaqt
    { wch: 20 }, // Sana
  ];

  // 2. Kitoblar bo'yicha umumiy statistika varag'i (Book Summary Sheet)
  const bookSummaryMap: Record<string, { totalStudents: number; totalScoreSum: number; maxScore: number }> = {};
  filtered.forEach((item) => {
    if (!bookSummaryMap[item.bookTitle]) {
      bookSummaryMap[item.bookTitle] = { totalStudents: 0, totalScoreSum: 0, maxScore: 0 };
    }
    bookSummaryMap[item.bookTitle].totalStudents += 1;
    bookSummaryMap[item.bookTitle].totalScoreSum += item.percentage;
    if (item.percentage > bookSummaryMap[item.bookTitle].maxScore) {
      bookSummaryMap[item.bookTitle].maxScore = item.percentage;
    }
  });

  const summaryRows = Object.keys(bookSummaryMap).map((title, idx) => ({
    "№": idx + 1,
    "Kitob nomi": title,
    "Topshirgan o'quvchilar soni": bookSummaryMap[title].totalStudents,
    "O'rtacha o'zlashtirish (%)": `${Math.round(bookSummaryMap[title].totalScoreSum / bookSummaryMap[title].totalStudents)}%`,
    "Eng yuqori natija (%)": `${bookSummaryMap[title].maxScore}%`,
  }));

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet['!cols'] = [
    { wch: 6 },
    { wch: 30 },
    { wch: 28 },
    { wch: 25 },
    { wch: 22 },
  ];

  // Workbook yaratish
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "O'quvchilar natijalari");
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Kitoblar statistikasi");

  // Fayl nomini generatsiya qilish
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `Maktab_Kitob_Test_Natijalari_${dateStr}.xlsx`;

  // Faylni yuklab berish
  XLSX.writeFile(workbook, fileName);
}
