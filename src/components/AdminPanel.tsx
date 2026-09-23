import React, { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  FileSpreadsheet,
  Settings,
  Plus,
  Trash2,
  Edit2,
  Save,
  Check,
  Search,
  AlertCircle,
  HelpCircle,
  FileText,
  Upload,
  RefreshCw,
  FileType,
  CheckCircle2,
  Globe,
  Sliders,
  Award,
  Download,
  UploadCloud,
  RotateCcw,
  SlidersHorizontal,
  Shuffle,
  Clock,
  Percent,
  CheckCircle,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import {
  Book,
  Question,
  TestDeliveryConfig,
  AIGenerationConfig,
  StudentTestResult,
} from '../types';
import { safeFetchJson } from '../utils/api';
import { exportResultsToExcel } from '../utils/excelExport';
import { extractPdfTextInBrowser } from '../utils/pdfExtractor';
import { StudentAnalyticsDashboard } from './StudentAnalyticsDashboard';

interface AdminPanelProps {
  books: Book[];
  onUpdateBooks: (books: Book[]) => void;
  deliveryConfig: TestDeliveryConfig;
  onUpdateDeliveryConfig: (config: TestDeliveryConfig) => void;
  results: StudentTestResult[];
  onClearResults: () => void;
  onDeleteResult?: (id: string) => void;
  onResetToInitialBooks?: () => void;
  adminToken?: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  books,
  onUpdateBooks,
  deliveryConfig,
  onUpdateDeliveryConfig,
  results,
  onClearResults,
  onDeleteResult,
  onResetToInitialBooks,
  adminToken,
}) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'edit-books' | 'analytics' | 'settings'>('generate');

  // --- AI Generation State ---
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [newBookGrade, setNewBookGrade] = useState('8-sinf');
  const [newBookText, setNewBookText] = useState('');
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
  const [pdfStats, setPdfStats] = useState<{ pageCount: number; charCount: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [genConfig, setGenConfig] = useState<AIGenerationConfig>({
    totalGenerateCount: 80,
    multipleChoiceGenerateCount: 60,
    writtenGenerateCount: 20,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [genError, setGenError] = useState<string | null>(null);
  const [genSuccessMessage, setGenSuccessMessage] = useState<string | null>(null);

  // --- Edit Questions State ---
  const [selectedBookId, setSelectedBookId] = useState<string>(books[0]?.id || '');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newQuestionType, setNewQuestionType] = useState<'multiple-choice' | 'written'>('multiple-choice');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newOptions, setNewOptions] = useState(['', '', '', '']);
  const [newCorrectIndex, setNewCorrectIndex] = useState(0);
  const [newExpectedAnswer, setNewExpectedAnswer] = useState('');
  const [newKeywords, setNewKeywords] = useState('');

  // --- Analytics Filter State ---
  const [searchStudent, setSearchStudent] = useState('');
  const [filterClass, setFilterClass] = useState('all');

  const selectedBook = books.find((b) => b.id === selectedBookId) || books[0];

  // Process PDF File Upload
  const handleFileProcessing = async (file: File) => {
    if (!file) return;

    setGenError(null);
    setGenSuccessMessage(null);

    // If text file (.txt)
    if (file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          setNewBookText(text);
          if (!newBookTitle) {
            setNewBookTitle(file.name.replace(/\.txt$/i, '').replace(/[_-]/g, ' '));
          }
        }
      };
      reader.readAsText(file);
      return;
    }

    // If PDF file (.pdf)
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      setIsParsingPdf(true);
      setPdfFileName(file.name);
      setPdfProgress({ current: 0, total: 0 });

      // Auto-suggest title if blank
      if (!newBookTitle) {
        const cleanName = file.name
          .replace(/\.pdf$/i, '')
          .replace(/[_\-]+/g, ' ')
          .trim();
        setNewBookTitle(cleanName);
      }

      try {
        // 1. Primary: Extract PDF text directly inside the browser using Mozilla PDF.js!
        // This is 100% immune to Vercel's 4.5MB request payload limit (FUNCTION_PAYLOAD_TOO_LARGE).
        const result = await extractPdfTextInBrowser(file, (current, total) => {
          setPdfProgress({ current, total });
        });

        if (result.text && result.text.length > 50) {
          setNewBookText(result.text);
          setPdfStats({
            pageCount: result.pageCount,
            charCount: result.characterCount,
          });
          setPdfProgress(null);
          setIsParsingPdf(false);
          return;
        }

        // If client extraction returned empty (e.g. scanned images without text layer)
        if (file.size > 4 * 1024 * 1024) {
          throw new Error(
            "Ushbu PDF fayldan matn ajratib bo'lmadi (ehtimol skanerlangan rasm yoki matnsiz formatda). Iltimos, elektron matnli PDF yuklang yoki kitob matnidan nusxa ko'chirib quyidagi matn maydoniga joylashtiring."
          );
        }

        // 2. Fallback for small files (< 4MB) to server endpoint
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64String = e.target?.result as string;
          setPdfBase64(base64String);

          try {
            const token = adminToken || sessionStorage.getItem('maktab_admin_token') || '';
            const data = await safeFetchJson<{
              success: boolean;
              error?: string;
              fullText: string;
              pageCount: number;
              characterCount: number;
            }>('/api/parse-pdf', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ pdfBase64: base64String }),
            });

            if (!data.success) {
              throw new Error(data.error || "PDF matnini ajratib bo'lmadi.");
            }

            setNewBookText(data.fullText);
            setPdfStats({
              pageCount: data.pageCount,
              charCount: data.characterCount,
            });
          } catch (err: any) {
            console.error(err);
            setGenError(err?.message || "PDF faylini o'qishda xatolik yuz berdi.");
          } finally {
            setIsParsingPdf(false);
            setPdfProgress(null);
          }
        };
        reader.readAsDataURL(file);
      } catch (err: any) {
        console.error("PDF extraction error:", err);
        setGenError(
          err?.message ||
          "PDF faylini o'qishda xatolik yuz berdi. Iltimos skaner qilinmagan, matnli PDF kitob yuklang yoki matnni to'g'ridan-to'g'ri maydonga kiriting."
        );
        setIsParsingPdf(false);
        setPdfProgress(null);
      }
      return;
    } else {
      setGenError("Faqat PDF (.pdf) yoki matn (.txt) formatidagi fayllarni yuklashingiz mumkin.");
    }
  };

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcessing(file);
    }
  };

  // Handle AI Test Generation with Professional Analysis
  const handleGenerateQuestions = async () => {
    if (!newBookTitle.trim()) {
      setGenError("Iltimos, kitob nomini kiriting!");
      return;
    }

    if (!newBookText.trim() && !pdfBase64) {
      setGenError("Iltimos, PDF kitob yuklang yoki kitob matnini kiriting!");
      return;
    }

    setGenError(null);
    setGenSuccessMessage(null);
    setIsGenerating(true);
    setGenerationStep("Kitob tahlil qilinmoqda va adabiy kontekst tekshirilmoqda...");

    try {
      setTimeout(() => {
        setGenerationStep("Professional saviyadagi testlar va yaqin variantlar (chalg'ituvchi variantlar) tuzilmoqda...");
      }, 3500);

      const token = adminToken || sessionStorage.getItem('maktab_admin_token') || '';
      const resData = await safeFetchJson<{
        success: boolean;
        error?: string;
        data: {
          multipleChoiceQuestions: any[];
          writtenQuestions: any[];
        };
      }>('/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          bookTitle: newBookTitle,
          author: newBookAuthor,
          grade: newBookGrade,
          bookText: newBookText ? newBookText.slice(0, 150000) : '',
          // Never send large pdfBase64 to avoid Vercel 4.5MB FUNCTION_PAYLOAD_TOO_LARGE
          pdfBase64: !newBookText && pdfBase64 && pdfBase64.length < 3 * 1024 * 1024 ? pdfBase64 : undefined,
          multipleChoiceCount: genConfig.multipleChoiceGenerateCount,
          writtenCount: genConfig.writtenGenerateCount,
        }),
      });

      if (!resData.success || !resData.data) {
        throw new Error(resData.error || "Savollarni generatsiya qilishda xatolik yuz berdi");
      }

      const rawData = resData.data;
      const generatedMC: Question[] = (rawData.multipleChoiceQuestions || []).map(
        (q: any, i: number) => ({
          id: `mc-${Date.now()}-${i}`,
          type: 'multiple-choice',
          question: q.question,
          options: q.options || ['A', 'B', 'C', 'D'],
          correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
          explanation: q.explanation || '',
        })
      );

      const generatedWritten: Question[] = (rawData.writtenQuestions || []).map(
        (q: any, i: number) => ({
          id: `w-${Date.now()}-${i}`,
          type: 'written',
          question: q.question,
          expectedAnswer: q.expectedAnswer || '',
          keywords: Array.isArray(q.keywords) ? q.keywords : [],
        })
      );

      const allQuestions = [...generatedMC, ...generatedWritten];

      const newBook: Book = {
        id: `book-${Date.now()}`,
        title: newBookTitle.trim(),
        author: newBookAuthor.trim() || "Muallif",
        grade: newBookGrade,
        coverColor: "from-blue-600 to-indigo-800",
        description: `Kitobdan AI yordamida ${allQuestions.length} ta yuqori saviyali, variantlari bir-biriga yaqin professional test savollari shakllantirildi (${generatedMC.length} ta variantli, ${generatedWritten.length} ta yozma).`,
        questions: allQuestions,
        createdAt: new Date().toISOString(),
      };

      const updated = [newBook, ...books];
      onUpdateBooks(updated);
      setSelectedBookId(newBook.id);

      setGenSuccessMessage(
        `Muvaffaqiyatli! "${newBookTitle}" kitobi bo'yicha jami ${allQuestions.length} ta yuqori saviyali test (${generatedMC.length} ta variantlari bir-biriga yaqin test va ${generatedWritten.length} ta yozma savol) professional darajada tuzildi va saqlandi.`
      );

      // Reset file & inputs
      setNewBookTitle('');
      setNewBookAuthor('');
      setNewBookText('');
      setPdfBase64(null);
      setPdfFileName(null);
      setPdfStats(null);
    } catch (err: any) {
      console.error(err);
      setGenError(err?.message || "AI serverida xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.");
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  // Add Question Manually
  const handleAddQuestionSubmit = () => {
    if (!newQuestionText.trim() || !selectedBook) return;

    let newQ: Question;
    if (newQuestionType === 'multiple-choice') {
      newQ = {
        id: `q-${Date.now()}`,
        type: 'multiple-choice',
        question: newQuestionText.trim(),
        options: [...newOptions],
        correctOptionIndex: newCorrectIndex,
      };
    } else {
      newQ = {
        id: `q-${Date.now()}`,
        type: 'written',
        question: newQuestionText.trim(),
        expectedAnswer: newExpectedAnswer.trim(),
        keywords: newKeywords.split(',').map((s) => s.trim()).filter(Boolean),
      };
    }

    const updatedQuestions = [newQ, ...selectedBook.questions];
    const updatedBooks = books.map((b) =>
      b.id === selectedBook.id ? { ...b, questions: updatedQuestions } : b
    );
    onUpdateBooks(updatedBooks);

    setIsAddingQuestion(false);
    setNewQuestionText('');
    setNewOptions(['', '', '', '']);
    setNewExpectedAnswer('');
    setNewKeywords('');
  };

  // Delete Question
  const handleDeleteQuestion = (questionId: string) => {
    if (!selectedBook) return;
    if (!confirm("Haqiqatan ham ushbu savolni o'chirmoqchimisiz?")) return;

    const updatedQuestions = selectedBook.questions.filter((q) => q.id !== questionId);
    const updatedBooks = books.map((b) =>
      b.id === selectedBook.id ? { ...b, questions: updatedQuestions } : b
    );
    onUpdateBooks(updatedBooks);
  };

  // Save edited question
  const handleSaveEditedQuestion = () => {
    if (!editingQuestion || !selectedBook) return;

    const updatedQuestions = selectedBook.questions.map((q) =>
      q.id === editingQuestion.id ? editingQuestion : q
    );
    const updatedBooks = books.map((b) =>
      b.id === selectedBook.id ? { ...b, questions: updatedQuestions } : b
    );
    onUpdateBooks(updatedBooks);
    setEditingQuestion(null);
  };

  // Delete Entire Book / Test
  const handleDeleteBook = (bookId: string) => {
    const target = books.find((b) => b.id === bookId);
    if (!target) return;
    if (
      !confirm(
        `Haqiqatan ham "${target.title}" kitobini va uning barcha ${target.questions.length} ta savollarini butunlay o'chirmoqchimisiz?`
      )
    ) {
      return;
    }

    const remaining = books.filter((b) => b.id !== bookId);
    onUpdateBooks(remaining);
    if (selectedBookId === bookId) {
      setSelectedBookId(remaining.length > 0 ? remaining[0].id : '');
    }
  };

  // Export all books & tests to JSON
  const handleExportBackup = () => {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      books,
      deliveryConfig,
    };
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(exportData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute(
      'download',
      `maktab_kitob_testlar_baza_${new Date().toISOString().slice(0, 10)}.json`
    );
    dlAnchor.click();
  };

  // Import books backup from JSON
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        let importedBooks: Book[] = [];
        if (Array.isArray(parsed)) {
          importedBooks = parsed;
        } else if (parsed?.books && Array.isArray(parsed.books)) {
          importedBooks = parsed.books;
          if (parsed.deliveryConfig) {
            onUpdateDeliveryConfig(parsed.deliveryConfig);
          }
        }

        if (importedBooks.length > 0 && importedBooks[0].questions) {
          onUpdateBooks(importedBooks);
          if (importedBooks[0]?.id) setSelectedBookId(importedBooks[0].id);
          alert(`Muvaffaqiyatli! ${importedBooks.length} ta kitob va ularning testlari tiklandi.`);
        } else {
          alert("Fayl formati mos kelmadi. Kitoblar ro'yxati topilmadi.");
        }
      } catch (err) {
        alert("JSON faylini o'qishda xatolik yuz berdi. Iltimos to'g'ri faylni tanlang.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filtered results
  const filteredResults = results.filter((r) => {
    const matchName = r.studentName.toLowerCase().includes(searchStudent.toLowerCase());
    const matchClass = filterClass === 'all' || r.studentGrade.toLowerCase().includes(filterClass.toLowerCase());
    return matchName && matchClass;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Top Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2 shadow-xs flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('generate')}
          className={`flex-1 min-w-[180px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'generate'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>PDF Kitob & Professional AI Test</span>
        </button>

        <button
          onClick={() => setActiveTab('edit-books')}
          className={`flex-1 min-w-[180px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'edit-books'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Savollarni Tahrirlash</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex-1 min-w-[180px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'analytics'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Analitika & Excel ({results.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 min-w-[180px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'settings'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Test Sozlamalari</span>
        </button>
      </div>

      {/* TAB 1: PDF BOOK UPLOAD & PROFESSIONAL AI GENERATION */}
      {activeTab === 'generate' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <span>PDF Kitob kiritish va Professional Test tuzish</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  PDF formatdagi to'liq kitobni yuklang. AI kitobni professional tarzda tahlil qiladi va variantlari bir-biriga yaqin, yuqori saviyali testlar tuzadi.
                </p>
              </div>

              {/* Quality Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs font-semibold">
                  <Award className="w-3.5 h-3.5 text-blue-600" />
                  <span>Yaqin variantli savollar</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
                  <Globe className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Adabiy tahlil</span>
                </span>
              </div>
            </div>
          </div>

          {genError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex flex-col gap-2 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                <div>
                  <p className="font-bold">Xatolik yuz berdi</p>
                  <p className="mt-0.5">{genError}</p>
                </div>
              </div>

              {(genError.includes('404') || genError.includes('Vercel') || genError.includes('GEMINI_API_KEY') || genError.includes('API') || genError.includes('FUNCTION_INVOCATION_FAILED') || genError.includes('FUNCTION_PAYLOAD_TOO_LARGE') || genError.includes('server error')) && (
                <div className="mt-2 p-3 bg-white rounded-lg border border-red-200 text-xs text-slate-700 space-y-1.5">
                  <p className="font-semibold text-red-800 flex items-center gap-1.5">
                    <span>💡 Vercel-da generatsiya qilish uchun qadamlar:</span>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600">
                    <li>Vercel Dashboard-ga kiring va loyihangiz sahifasini oching.</li>
                    <li><strong>Settings</strong> ➔ <strong>Environment Variables</strong> bo'limiga o'ting.</li>
                    <li>Yangi o'zgaruvchi qo'shing: <strong>Key</strong>: <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono">GEMINI_API_KEY</code>, <strong>Value</strong>: sizning Gemini API kalitingiz.</li>
                    <li>Loyiha GitHub omboriga yangi o'zgarishlarni yuklang yoki Vercel-da <strong>Redeploy</strong> tugmasini bosing.</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {genSuccessMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
              <Check className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <p className="font-bold">Bajarildi!</p>
                <p className="mt-0.5">{genSuccessMessage}</p>
              </div>
            </div>
          )}

          {/* PDF UPLOAD DRAG & DROP ZONE */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-50/80 scale-[1.01]'
                : pdfStats
                ? 'border-emerald-400 bg-emerald-50/30'
                : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <input
              type="file"
              accept=".pdf,.txt"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileProcessing(file);
              }}
            />

            {isParsingPdf ? (
              <div className="space-y-3 py-4 max-w-sm mx-auto">
                <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
                <p className="font-bold text-slate-800 text-sm">
                  {pdfProgress && pdfProgress.total > 0
                    ? `PDF kitob o'qilmoqda: ${pdfProgress.current} / ${pdfProgress.total} sahifa`
                    : "PDF kitob tahlil qilinmoqda..."}
                </p>
                {pdfProgress && pdfProgress.total > 0 && (
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-150"
                      style={{
                        width: `${Math.min(100, Math.round((pdfProgress.current / pdfProgress.total) * 100))}%`,
                      }}
                    />
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  {pdfProgress && pdfProgress.total > 0
                    ? `${Math.round((pdfProgress.current / pdfProgress.total) * 100)}% yakunlandi (brauzerda bevosita o'qilmoqda)`
                    : "Iltimos bir necha soniya kuting"}
                </p>
              </div>
            ) : pdfStats && pdfFileName ? (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-emerald-900 shadow-2xs">
                    <FileType className="w-4 h-4 text-emerald-600" />
                    <span>{pdfFileName}</span>
                  </div>
                  <p className="text-xs font-semibold text-emerald-800 mt-2">
                    PDF muvaffaqiyatli tahlil qilindi: <strong>{pdfStats.pageCount} sahifa</strong>,{' '}
                    <strong>{pdfStats.charCount.toLocaleString()} ta belgi</strong> ajratildi.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Boshqa PDF yuklash uchun faylni bu yerga tashlang yoki bosing.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm sm:text-base">
                    PDF kitobni shu yerga tashlang yoki faylni tanlang
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Qo'llab-quvvatlanadi: <strong>.pdf</strong> (badiiy asarlar, darsliklar) yoki <strong>.txt</strong>
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs">
                  <span>Kompyuterdan tanlash</span>
                </div>
              </div>
            )}
          </div>

          {/* Book Information Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kitob nomi:
              </label>
              <input
                type="text"
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                placeholder="Masalan: O'tkan kunlar"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Muallif:
              </label>
              <input
                type="text"
                value={newBookAuthor}
                onChange={(e) => setNewBookAuthor(e.target.value)}
                placeholder="Masalan: Abdulla Qodiriy"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tavsiya etilgan sinf:
              </label>
              <select
                value={newBookGrade}
                onChange={(e) => setNewBookGrade(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-blue-600 focus:outline-none bg-white"
              >
                <option value="5-sinf">5-sinf</option>
                <option value="6-sinf">6-sinf</option>
                <option value="7-sinf">7-sinf</option>
                <option value="8-sinf">8-sinf</option>
                <option value="9-sinf">9-sinf</option>
                <option value="10-sinf">10-sinf</option>
                <option value="11-sinf">11-sinf</option>
              </select>
            </div>
          </div>

          {/* AI Generator Settings (Admin can modify!) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                <span>AI Savollar soni sozlamalari (Admin o'zgartira oladi):</span>
              </h4>
              <span className="text-xs text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                Standart: 80 ta savol (60 ta variantli + 20 ta yozma)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Variantli savollar (A, B, C, D):
                </label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={genConfig.multipleChoiceGenerateCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setGenConfig({
                      ...genConfig,
                      multipleChoiceGenerateCount: val,
                      totalGenerateCount: val + genConfig.writtenGenerateCount,
                    });
                  }}
                  className="w-full px-3 py-2 text-sm font-bold bg-white rounded-lg border border-slate-300"
                />
                <p className="text-xs text-slate-400 mt-1">Yaqin variantli chalg'ituvchi savollar</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Javob yoziladigan savollar:
                </label>
                <input
                  type="number"
                  min="2"
                  max="50"
                  value={genConfig.writtenGenerateCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setGenConfig({
                      ...genConfig,
                      writtenGenerateCount: val,
                      totalGenerateCount: genConfig.multipleChoiceGenerateCount + val,
                    });
                  }}
                  className="w-full px-3 py-2 text-sm font-bold bg-white rounded-lg border border-slate-300"
                />
                <p className="text-xs text-slate-400 mt-1">Ochiq tahliliy savollar</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Jami tuziladigan savollar:
                </label>
                <div className="px-3 py-2 text-sm font-extrabold bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                  {genConfig.multipleChoiceGenerateCount + genConfig.writtenGenerateCount} ta savol
                </div>
                <p className="text-xs text-slate-400 mt-1">Savollar bazasiga qo'shiladi</p>
              </div>
            </div>
          </div>

          {/* Book Textarea / Extracted content */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Kitob matni (PDF dan avtomatik olingan yoki qo'lda kiritilgan):
              </label>
              <span className="text-xs text-slate-400">
                Belgilar soni: {newBookText.length.toLocaleString()}
              </span>
            </div>
            <textarea
              rows={7}
              value={newBookText}
              onChange={(e) => setNewBookText(e.target.value)}
              placeholder="PDF kitob yuklansa matn avtomatik bu yerga tushadi, yoki kitob matnidan nusxa olib qo'yishingiz mumkin..."
              className="w-full p-4 rounded-xl border border-slate-300 focus:border-blue-600 focus:outline-none text-slate-900 text-xs sm:text-sm font-mono leading-relaxed"
            />
          </div>

          {/* Professional Pedagogical Notice */}
          <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-indigo-950">
              <Award className="w-4 h-4 text-indigo-700" />
              <span>Professional Pedagogik Standart & Yaqin Variantlar:</span>
            </div>
            <p className="leading-relaxed text-indigo-800">
              Savollar kitobning asosiy qahramonlari, syujet ziddiyatlari, ruhiy kechinmalar va muallif g'oyasini chuqur tahlil qiluvchi darajada tuziladi. 
              Variantlar (A, B, C, D) tasodifiy bo'lmay, bir-biriga juda yaqin va mantiqiy bo'lib, o'quvchining asarni sinchiklab o'qiganligini haqiqiy baholaydi.
            </p>
          </div>

          {/* Action button & progress */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="text-xs text-slate-500">
              {isGenerating && generationStep && (
                <span className="font-semibold text-blue-600 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                  <span>{generationStep}</span>
                </span>
              )}
            </div>

            <button
              onClick={handleGenerateQuestions}
              disabled={isGenerating || !newBookTitle || (!newBookText && !pdfBase64)}
              className="px-7 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Professional testlar tuzilmoqda...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    AI orqali {genConfig.totalGenerateCount} ta professional testni yaratish
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: EDIT QUESTIONS */}
      {activeTab === 'edit-books' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <span>Kitoblar va Savollarni Tahrirlash</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Savollarni tahrirlash, yangi savol qo'shish yoki o'chirish
              </p>
            </div>

            {/* Book Selector & Delete Book Action */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Kitob:</span>
                <select
                  value={selectedBookId}
                  onChange={(e) => setSelectedBookId(e.target.value)}
                  className="px-3 py-2 text-sm font-semibold rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                >
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} ({b.questions.length} ta savol)
                    </option>
                  ))}
                </select>
              </div>

              {selectedBook && (
                <button
                  type="button"
                  onClick={() => handleDeleteBook(selectedBook.id)}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  title="Ushbu kitob va barcha test savollarini o'chirish"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  <span>Kitobni o'chirish</span>
                </button>
              )}
            </div>
          </div>

          {!selectedBook ? (
            <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2">
              <p className="text-sm font-semibold text-slate-700">Hozircha birorta ham kitob mavjud emas.</p>
              <p className="text-xs text-slate-500">
                "AI bilan yangi test tuzish" bo'limidan PDF yuklab yangi testlar bazasini yarating yoki sozlamalardan dastlabki kitoblarni tiklang.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-bold text-slate-800">
                    Jami savollar: {selectedBook.questions.length} ta
                  </span>
                  <span>•</span>
                  <span className="text-blue-700 font-semibold">
                    {selectedBook.questions.filter((q) => q.type === 'multiple-choice').length} ta variantli
                  </span>
                  <span>•</span>
                  <span className="text-indigo-700 font-semibold">
                    {selectedBook.questions.filter((q) => q.type === 'written').length} ta yozma
                  </span>
                </div>

                <button
                  onClick={() => setIsAddingQuestion(true)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Yangi savol qo'shish</span>
                </button>
              </div>

              {/* Add Question Form Inline */}
              {isAddingQuestion && (
                <div className="p-5 border-2 border-blue-500 bg-blue-50/40 rounded-xl space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-sm">
                      Yangi savol qo'shish
                    </h3>
                    <button
                      onClick={() => setIsAddingQuestion(false)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Yopish
                    </button>
                  </div>

                  <div className="flex gap-4 text-xs font-medium">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="qtype"
                        checked={newQuestionType === 'multiple-choice'}
                        onChange={() => setNewQuestionType('multiple-choice')}
                      />
                      <span>Variantli savol (A, B, C, D)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="qtype"
                        checked={newQuestionType === 'written'}
                        onChange={() => setNewQuestionType('written')}
                      />
                      <span>Javob yoziladigan savol</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Savol matni:
                    </label>
                    <input
                      type="text"
                      value={newQuestionText}
                      onChange={(e) => setNewQuestionText(e.target.value)}
                      placeholder="Savolni kiriting..."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                    />
                  </div>

                  {newQuestionType === 'multiple-choice' ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Variantlar va to'g'ri javob (bir-biriga yaqin variantlar yozing):
                      </label>
                      {newOptions.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="correctOpt"
                            checked={newCorrectIndex === oIdx}
                            onChange={() => setNewCorrectIndex(oIdx)}
                            className="cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-600 w-4">
                            {String.fromCharCode(65 + oIdx)}:
                          </span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const opts = [...newOptions];
                              opts[oIdx] = e.target.value;
                              setNewOptions(opts);
                            }}
                            placeholder={`Variant ${String.fromCharCode(65 + oIdx)}`}
                            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          To'g'ri javob (etalon):
                        </label>
                        <input
                          type="text"
                          value={newExpectedAnswer}
                          onChange={(e) => setNewExpectedAnswer(e.target.value)}
                          placeholder="To'g'ri javob matni..."
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Kalit so'zlar (vergul bilan):
                        </label>
                        <input
                          type="text"
                          value={newKeywords}
                          onChange={(e) => setNewKeywords(e.target.value)}
                          placeholder="masalan: Qodiriy, Otabek, Marg'ilon"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsAddingQuestion(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Bekor qilish
                    </button>
                    <button
                      onClick={handleAddQuestionSubmit}
                      className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"
                    >
                      Saqlash
                    </button>
                  </div>
                </div>
              )}

              {/* Questions List */}
              <div className="space-y-3 pt-2">
                {selectedBook.questions.map((q, idx) => {
                  const isEditingThis = editingQuestion?.id === q.id;

                  if (isEditingThis && editingQuestion) {
                    return (
                      <div
                        key={q.id}
                        className="p-4 rounded-xl border-2 border-amber-400 bg-amber-50/50 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-800">
                            Savol #{idx + 1} tahrirlanmoqda
                          </span>
                          <button
                            onClick={() => setEditingQuestion(null)}
                            className="text-xs text-slate-500"
                          >
                            Bekor qilish
                          </button>
                        </div>

                        <input
                          type="text"
                          value={editingQuestion.question}
                          onChange={(e) =>
                            setEditingQuestion({
                              ...editingQuestion,
                              question: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white font-medium"
                        />

                        {editingQuestion.type === 'multiple-choice' && editingQuestion.options && (
                          <div className="space-y-2">
                            {editingQuestion.options.map((opt, oIdx) => (
                              <div key={oIdx} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`edit-opt-${q.id}`}
                                  checked={editingQuestion.correctOptionIndex === oIdx}
                                  onChange={() =>
                                    setEditingQuestion({
                                      ...editingQuestion,
                                      correctOptionIndex: oIdx,
                                    })
                                  }
                                />
                                <span className="text-xs font-bold text-slate-600">
                                  {String.fromCharCode(65 + oIdx)}:
                                </span>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    const opts = [...(editingQuestion.options || [])];
                                    opts[oIdx] = e.target.value;
                                    setEditingQuestion({
                                      ...editingQuestion,
                                      options: opts,
                                    });
                                  }}
                                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {editingQuestion.type === 'written' && (
                          <div className="space-y-2">
                            <label className="block text-xs font-medium text-slate-700">
                              To'g'ri javob:
                            </label>
                            <input
                              type="text"
                              value={editingQuestion.expectedAnswer || ''}
                              onChange={(e) =>
                                setEditingQuestion({
                                  ...editingQuestion,
                                  expectedAnswer: e.target.value,
                                })
                              }
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                            />
                          </div>
                        )}

                        <div className="flex justify-end gap-2">
                          <button
                            onClick={handleSaveEditedQuestion}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>O'zgarishni saqlash</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-xs uppercase font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                            {q.type === 'multiple-choice' ? 'Variantli' : 'Yozma'}
                          </span>
                        </div>

                        <p className="font-semibold text-slate-900 text-sm">
                          {q.question}
                        </p>

                        {q.type === 'multiple-choice' && q.options && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-xs">
                            {q.options.map((opt, oIdx) => (
                              <div
                                key={oIdx}
                                className={`px-2.5 py-1 rounded-md border ${
                                  q.correctOptionIndex === oIdx
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                                    : 'bg-white border-slate-200 text-slate-600'
                                }`}
                              >
                                {String.fromCharCode(65 + oIdx)}) {opt}
                              </div>
                            ))}
                          </div>
                        )}

                        {q.type === 'written' && (
                          <p className="text-xs text-indigo-800 bg-indigo-50 p-2 rounded-md">
                            <strong>Etalon javob:</strong> {q.expectedAnswer}
                          </p>
                        )}

                        {q.explanation && (
                          <p className="text-xs text-slate-500 italic mt-1">
                            <strong>Farqi/Izoh:</strong> {q.explanation}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setEditingQuestion(q)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-colors"
                          title="Tahrirlash"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
                          title="O'chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ANALYTICS & RECHARTS DASHBOARD & EXCEL EXPORT */}
      {activeTab === 'analytics' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>Natijalar & Analitika Dashboard</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                O'quvchilar ko'rsatkichlari, sinflar va kitoblar dinamikasi (Recharts) hamda hisobotlar
              </p>
            </div>

            {/* Excel Download Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportResultsToExcel(results)}
                disabled={results.length === 0}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel yuklab olish (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div className="text-2xl font-black text-slate-900">{results.length}</div>
              <div className="text-xs text-slate-500 font-medium mt-1">Topshirganlar</div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div className="text-2xl font-black text-blue-600">
                {results.length > 0
                  ? Math.round(
                      results.reduce((acc, r) => acc + r.percentage, 0) / results.length
                    )
                  : 0}
                %
              </div>
              <div className="text-xs text-slate-500 font-medium mt-1">O'rtacha Ball</div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div className="text-2xl font-black text-emerald-600">
                {results.filter((r) => r.percentage >= (deliveryConfig.grade5Threshold || 86)).length}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-1">A'lo baholar (5)</div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div className="text-2xl font-black text-amber-600">
                {results.filter((r) => r.percentage < (deliveryConfig.grade3Threshold || 56)).length}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-1">Qoniqarsiz (2)</div>
            </div>
          </div>

          {/* Interactive Recharts Dashboard */}
          <StudentAnalyticsDashboard
            results={results}
            deliveryConfig={deliveryConfig}
          />

          {/* Filters and Search Bar */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    placeholder="O'quvchi ismini izlash..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value="all">Barcha sinflar</option>
                  <option value="5">5-sinflar</option>
                  <option value="6">6-sinflar</option>
                  <option value="7">7-sinflar</option>
                  <option value="8">8-sinflar</option>
                  <option value="9">9-sinflar</option>
                  <option value="10">10-sinflar</option>
                  <option value="11">11-sinflar</option>
                </select>
              </div>

              {results.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Haqiqatan ham barcha natijalar tarixini butunlay tozalashni xohlaysizmi?")) {
                      onClearResults();
                    }
                  }}
                  className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Barcha natijalarni tozalash</span>
                </button>
              )}
            </div>

            {/* Results Table */}
            {filteredResults.length === 0 ? (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl text-xs">
                {results.length === 0
                  ? "Hozircha natijalar mavjud emas. O'quvchilar test topshirgach bu yerda barcha ma'lumotlar ko'rinadi."
                  : "Qidiruv bo'yicha mos keladigan o'quvchi topilmadi."}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase tracking-wider border-b">
                    <tr>
                      <th className="p-3">T/r</th>
                      <th className="p-3">O'quvchi</th>
                      <th className="p-3">Sinf</th>
                      <th className="p-3">Kitob</th>
                      <th className="p-3">Ball / Foiz</th>
                      <th className="p-3">Baho</th>
                      <th className="p-3">Variantli</th>
                      <th className="p-3">Yozma</th>
                      <th className="p-3">Sana</th>
                      <th className="p-3 text-right">Amal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredResults.map((res, index) => (
                      <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-semibold text-slate-500">{index + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{res.studentName}</td>
                        <td className="p-3 text-slate-700">{res.studentGrade}</td>
                        <td className="p-3 font-medium text-slate-800">{res.bookTitle}</td>
                        <td className="p-3">
                          <span className="font-bold text-slate-900">{res.score}/{res.totalQuestions}</span>
                          <span className="text-slate-400 ml-1">({res.percentage}%)</span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                              res.percentage >= (deliveryConfig.grade5Threshold || 86)
                                ? 'bg-emerald-100 text-emerald-800'
                                : res.percentage >= (deliveryConfig.grade4Threshold || 71)
                                ? 'bg-blue-100 text-blue-800'
                                : res.percentage >= (deliveryConfig.grade3Threshold || 56)
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {res.gradeBadge}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">
                          {res.multipleChoiceCorrect} / {res.multipleChoiceTotal}
                        </td>
                        <td className="p-3 text-slate-600">
                          {res.writtenCorrect} / {res.writtenTotal}
                        </td>
                        <td className="p-3 text-slate-500">
                          {new Date(res.completedAt).toLocaleDateString('uz-UZ')}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`"${res.studentName}" natijasini o'chirishni xohlaysizmi?`)) {
                                onDeleteResult?.(res.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            title="Ushbu natijani o'chirish"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: KATTA KENGAYTIRILGAN SOZLAMALAR (EXTENDED SETTINGS) */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-8">
          <div className="border-b pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-blue-600" />
                <span>Katta Kengaytirilgan Sozlamalar</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Test topshirish parametrlari, baholash foizlari, AI tekshiruv qat'iyligi va tizim zaxiralari
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportBackup}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Barcha kitoblar va testlarni JSON fayl qilib yuklab olish"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Zaxira nusxa (JSON)</span>
              </button>

              <label className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-200">
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Tiklash (JSON)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* SECTION 1: Test topshirish parametrlari */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>1. Test Topshirish Parametrlari</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Jami beriladigan savollar:
                </label>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={deliveryConfig.totalQuestions}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    onUpdateDeliveryConfig({
                      ...deliveryConfig,
                      totalQuestions: val,
                    });
                  }}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 font-bold focus:border-blue-600 focus:outline-none"
                />
                <p className="text-2xs text-slate-400 mt-1">Standart: 20 ta</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Variantli savollar soni:
                </label>
                <input
                  type="number"
                  min="1"
                  max="40"
                  value={deliveryConfig.multipleChoiceCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    onUpdateDeliveryConfig({
                      ...deliveryConfig,
                      multipleChoiceCount: val,
                      totalQuestions: val + deliveryConfig.writtenCount,
                    });
                  }}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 font-bold focus:border-blue-600 focus:outline-none"
                />
                <p className="text-2xs text-slate-400 mt-1">Standart: 15 ta</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Javob yoziladigan savollar:
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={deliveryConfig.writtenCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    onUpdateDeliveryConfig({
                      ...deliveryConfig,
                      writtenCount: val,
                      totalQuestions: deliveryConfig.multipleChoiceCount + val,
                    });
                  }}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 font-bold focus:border-blue-600 focus:outline-none"
                />
                <p className="text-2xs text-slate-400 mt-1">Standart: 5 ta</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Ajratilgan vaqt (daqiqa):
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={deliveryConfig.timeLimitMinutes}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 25;
                    onUpdateDeliveryConfig({
                      ...deliveryConfig,
                      timeLimitMinutes: val,
                    });
                  }}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 font-bold focus:border-blue-600 focus:outline-none"
                />
                <p className="text-2xs text-slate-400 mt-1">Standart: 25 daqiqa</p>
              </div>
            </div>

            {/* Random Shuffle Toggle */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Shuffle className="w-3.5 h-3.5 text-blue-600" />
                  <span>Savollarni tasodifiy aralashtirish (Random Shuffle)</span>
                </div>
                <p className="text-xs text-slate-500">
                  Har bir o'quvchi testni boshlaganda kitob savollari bazasidan tasodifiy tartibda savollar tanlanadi
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={deliveryConfig.shuffleQuestions ?? true}
                  onChange={(e) =>
                    onUpdateDeliveryConfig({
                      ...deliveryConfig,
                      shuffleQuestions: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* SECTION 2: Baholash mezonlari va chegaralari */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Percent className="w-4 h-4 text-emerald-600" />
              <span>2. Baholash Mezonlari va Minimal Foiz Chegaralari</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-emerald-900 block">5 ("A'lo") baho:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="75"
                    max="100"
                    value={deliveryConfig.grade5Threshold || 86}
                    onChange={(e) =>
                      onUpdateDeliveryConfig({
                        ...deliveryConfig,
                        grade5Threshold: parseInt(e.target.value) || 86,
                      })
                    }
                    className="w-20 px-2 py-1 bg-white border border-emerald-300 rounded-lg text-sm font-bold text-emerald-950"
                  />
                  <span className="text-xs font-bold text-emerald-700">% dan yuqori</span>
                </div>
                <p className="text-2xs text-emerald-700">O'zbekiston maktab standarti: 86%</p>
              </div>

              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-blue-900 block">4 ("Yaxshi") baho:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="60"
                    max="85"
                    value={deliveryConfig.grade4Threshold || 71}
                    onChange={(e) =>
                      onUpdateDeliveryConfig({
                        ...deliveryConfig,
                        grade4Threshold: parseInt(e.target.value) || 71,
                      })
                    }
                    className="w-20 px-2 py-1 bg-white border border-blue-300 rounded-lg text-sm font-bold text-blue-950"
                  />
                  <span className="text-xs font-bold text-blue-700">% dan yuqori</span>
                </div>
                <p className="text-2xs text-blue-700">O'zbekiston maktab standarti: 71%</p>
              </div>

              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-amber-900 block">3 ("Qoniqarli") baho:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="40"
                    max="70"
                    value={deliveryConfig.grade3Threshold || 56}
                    onChange={(e) =>
                      onUpdateDeliveryConfig({
                        ...deliveryConfig,
                        grade3Threshold: parseInt(e.target.value) || 56,
                      })
                    }
                    className="w-20 px-2 py-1 bg-white border border-amber-300 rounded-lg text-sm font-bold text-amber-950"
                  />
                  <span className="text-xs font-bold text-amber-700">% dan yuqori</span>
                </div>
                <p className="text-2xs text-amber-700">O'zbekiston maktab standarti: 56%</p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-slate-800 block">Minimal O'tish Bali:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="30"
                    max="70"
                    value={deliveryConfig.passingScorePercent || 56}
                    onChange={(e) =>
                      onUpdateDeliveryConfig({
                        ...deliveryConfig,
                        passingScorePercent: parseInt(e.target.value) || 56,
                      })
                    }
                    className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900"
                  />
                  <span className="text-xs font-bold text-slate-600">%</span>
                </div>
                <p className="text-2xs text-slate-500">Testdan muvaffaqiyatli o'tish chegarasi</p>
              </div>
            </div>
          </div>

          {/* SECTION 3: Sun'iy Intellekt va Tahlil Sozlamalari */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>3. Sun'iy Intellekt va Test Tajribasi Sozlamalari</span>
            </h3>

            <div className="space-y-3">
              {/* AI Strictness Selector */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Yozma javoblarni AI tomonidan tekshirish qat'iylik darajasi:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      (deliveryConfig.aiEvaluationStrictness || 'moderate') === 'lenient'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="aiStrictness"
                      value="lenient"
                      checked={(deliveryConfig.aiEvaluationStrictness || 'moderate') === 'lenient'}
                      onChange={() =>
                        onUpdateDeliveryConfig({
                          ...deliveryConfig,
                          aiEvaluationStrictness: 'lenient',
                        })
                      }
                      className="sr-only"
                    />
                    <div className="font-bold mb-1">🌱 Mehrli / Rag'batlantiruvchi</div>
                    <div className="text-2xs font-normal text-slate-500">
                      O'quvchi ma'noni tushungan bo'lsa va kalit so'zlardan foydalansa to'liq qabul qiladi
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      (deliveryConfig.aiEvaluationStrictness || 'moderate') === 'moderate'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="aiStrictness"
                      value="moderate"
                      checked={(deliveryConfig.aiEvaluationStrictness || 'moderate') === 'moderate'}
                      onChange={() =>
                        onUpdateDeliveryConfig({
                          ...deliveryConfig,
                          aiEvaluationStrictness: 'moderate',
                        })
                      }
                      className="sr-only"
                    />
                    <div className="font-bold mb-1">⚖️ Standart / O'rtacha (Tavsiya)</div>
                    <div className="text-2xs font-normal text-slate-500">
                      Pedagogik adolatli baholash, kitobdagi asosiy g'oya va dalillarga qaraydi
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      (deliveryConfig.aiEvaluationStrictness || 'moderate') === 'strict'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="aiStrictness"
                      value="strict"
                      checked={(deliveryConfig.aiEvaluationStrictness || 'moderate') === 'strict'}
                      onChange={() =>
                        onUpdateDeliveryConfig({
                          ...deliveryConfig,
                          aiEvaluationStrictness: 'strict',
                        })
                      }
                      className="sr-only"
                    />
                    <div className="font-bold mb-1">🎯 Qat'iy Ilmiy</div>
                    <div className="text-2xs font-normal text-slate-500">
                      Faqat etalon javobga to'liq mos kelgan va barcha faktik nuqtalarni yoritgan javoblar
                    </div>
                  </label>
                </div>
              </div>

              {/* Toggle: Show Explanations After Test */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                    <span>Test yakunlangach o'quvchiga to'g'ri javob va tahlillarni ko'rsatish</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    O'quvchi xatolarini tahlil qilib, to'g'ri javoblar va pedagogik izohlarni ko'rib o'rganishi uchun
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deliveryConfig.showExplanationsAfterTest ?? true}
                    onChange={(e) =>
                      onUpdateDeliveryConfig({
                        ...deliveryConfig,
                        showExplanationsAfterTest: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Toggle: Confetti animation */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    <span>A'lo (5) natija uchun bayramona konfetti animatsiyasi</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    O'quvchi yuqori ball to'plaganida qutlov animatsiyasi ko'rsatiladi
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deliveryConfig.enableConfetti ?? true}
                    onChange={(e) =>
                      onUpdateDeliveryConfig({
                        ...deliveryConfig,
                        enableConfetti: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 4: Tizim Ma'lumotlari va Qayta Tiklash */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-700" />
              <span>4. Tizim Boshqaruvi va Qayta Tiklash</span>
            </h3>

            <div className="p-4 bg-red-50/50 border border-red-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-red-900 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Boshlang'ich holatga qaytarish va tozalash</span>
              </div>
              <p className="text-xs text-red-700">
                Agar dastlabki o'zbek adabiyoti kitoblari (O'tkan kunlar, Shum bola, Sariq devni minib) bazasini qayta yuklamoqchi bo'lsangiz quyidagi tugmani bosing:
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        "Dastlabki kitoblarni tiklashni xohlaysizmi? Hozirgi kiritilgan o'zgarishlar o'rniga original kitoblar bazasi yuklanadi."
                      )
                    ) {
                      onResetToInitialBooks?.();
                      alert("Dastlabki kitoblar bazasi muvaffaqiyatli tiklandi.");
                    }
                  }}
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                  <span>Dastlabki kitoblarga qaytarish</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Barcha o'quvchilar test natijalari tarixini tozalashni xohlaysizmi?")) {
                      onClearResults();
                      alert("Natijalar tarixi tozalandi.");
                    }
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Barcha natijalarni tozalash</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

