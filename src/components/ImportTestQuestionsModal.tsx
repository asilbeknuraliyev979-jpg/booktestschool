import React, { useState, useRef } from 'react';
import {
  FileUp,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  BookOpen,
  HelpCircle,
  Layers,
  ArrowRight,
  Eye,
  Trash2,
  Edit2,
  FileCheck,
  Check,
} from 'lucide-react';
import { Book, Question } from '../types';
import { extractDocumentText } from '../utils/documentExtractor';
import { parseExternalQuizText, ParseResult } from '../utils/quizTextParser';
import { sanitizeQuestionToLatin } from '../utils/transliterate';

interface ImportTestQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
  currentBookId?: string;
  onImportToBook: (bookId: string, questions: Question[]) => Promise<void> | void;
  onCreateNewBookWithQuestions: (
    title: string,
    author: string,
    grade: string,
    questions: Question[]
  ) => Promise<void> | void;
}

export const ImportTestQuestionsModal: React.FC<ImportTestQuestionsModalProps> = ({
  isOpen,
  onClose,
  books,
  currentBookId,
  onImportToBook,
  onCreateNewBookWithQuestions,
}) => {
  // Processing States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [readingProgress, setReadingProgress] = useState<{ current: number; total: number } | null>(null);
  const [rawPastedText, setRawPastedText] = useState('');
  const [activeInputMode, setActiveInputMode] = useState<'file' | 'text'>('file');

  // Parsed Questions State
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Target Destination Options
  const [destinationMode, setDestinationMode] = useState<'existing' | 'new'>(
    books.length > 0 ? 'existing' : 'new'
  );
  const [targetBookId, setTargetBookId] = useState<string>(
    currentBookId || (books.length > 0 ? books[0].id : '')
  );
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [newBookGrade, setNewBookGrade] = useState('8-sinf');

  // Preview & Edit
  const [previewTab, setPreviewTab] = useState<'all' | 'mc' | 'written'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Process Document (Word .docx, .doc, PDF, .txt)
  const handleProcessFile = async (file: File) => {
    if (!file) return;
    setSelectedFile(file);
    setIsReadingFile(true);
    setReadingProgress(null);
    setErrorMessage(null);

    // Auto suggest book title from file name
    const cleanTitle = file.name
      .replace(/\.(docx?|pdf|txt|rtf)$/i, '')
      .replace(/[_\-]+/g, ' ')
      .trim();
    if (!newBookTitle) {
      setNewBookTitle(cleanTitle);
    }

    try {
      const extracted = await extractDocumentText(file, (current, total) => {
        setReadingProgress({ current, total });
      });

      if (!extracted.text || extracted.text.trim().length < 20) {
        throw new Error("Fayldan yetarli matn o'qib bo'lmadi. Fayl bo'sh emasligiga ishonch hosil qiling.");
      }

      setRawPastedText(extracted.text);
      runParser(extracted.text);
    } catch (err: any) {
      console.error('File parsing error:', err);
      setErrorMessage(
        err?.message || "Faylni o'qishda xatolik yuz berdi. Iltimos boshqa fayl yuklab ko'ring."
      );
    } finally {
      setIsReadingFile(false);
      setReadingProgress(null);
    }
  };

  // Run text parsing
  const runParser = (text: string) => {
    const res = parseExternalQuizText(text);
    setParseResult(res);
    const combined = [...res.multipleChoiceQuestions, ...res.writtenQuestions];
    setParsedQuestions(combined);

    if (combined.length === 0) {
      setErrorMessage(
        "Fayl matnidan test savollari aniqlanmadi. Savollar raqamlangan (1. 2. 3.) va variantlari (A, B, C, D) ko'rinishida ekanligini tekshiring."
      );
    } else {
      setErrorMessage(null);
    }
  };

  const handleManualTextParse = () => {
    if (!rawPastedText.trim()) {
      setErrorMessage("Iltimos, avval test savollari matnini kiriting yoki fayl yuklang.");
      return;
    }
    runParser(rawPastedText);
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  // Remove single question from preview
  const handleRemoveQuestion = (qId: string) => {
    setParsedQuestions((prev) => prev.filter((q) => q.id !== qId));
  };

  // Confirm Import
  const handleConfirmImport = async () => {
    if (parsedQuestions.length === 0) {
      alert("Import qilish uchun kamida 1 ta test savoli mavjud bo'lishi kerak.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (destinationMode === 'existing') {
        if (!targetBookId) {
          alert("Iltimos, savollar qo'shiladigan kitobni tanlang.");
          setIsSubmitting(false);
          return;
        }
        await onImportToBook(targetBookId, parsedQuestions);
      } else {
        const title = newBookTitle.trim() || 'Import Qilingan Testlar';
        const author = newBookAuthor.trim() || 'Noma\'lum muallif';
        await onCreateNewBookWithQuestions(title, author, newBookGrade, parsedQuestions);
      }
      onClose();
    } catch (err: any) {
      console.error('Import confirmation error:', err);
      alert("Testlarni saqlashda xatolik yuz berdi: " + (err?.message || 'Noma\'lum xato'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredQuestions = parsedQuestions.filter((q) => {
    if (previewTab === 'mc') return q.type === 'multiple-choice';
    if (previewTab === 'written') return q.type === 'written';
    return true;
  });

  const mcCount = parsedQuestions.filter((q) => q.type === 'multiple-choice').length;
  const wrCount = parsedQuestions.filter((q) => q.type === 'written').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-5 sm:p-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs border border-white/20">
              <FileUp className="w-6 h-6 text-blue-200" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                PDF & Word (.docx) Fayldan Testlarni Import Qilish
              </h2>
              <p className="text-xs sm:text-sm text-blue-100 mt-0.5">
                Tayyor test faylingizni yuklang — tizim matnni o'qib, barcha savol va variantlarni avtomatik ajratib oladi.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Input Method Switcher */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <button
              type="button"
              onClick={() => setActiveInputMode('file')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
                activeInputMode === 'file'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Word (.docx) yoki PDF Fayl Yuklash</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveInputMode('text')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
                activeInputMode === 'text'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Edit2 className="w-4 h-4" />
              <span>Matn Nusxalab Qo'yish (Paste Text)</span>
            </button>
          </div>

          {/* Mode 1: File Upload */}
          {activeInputMode === 'file' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.doc,.pdf,.txt,.md"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleProcessFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/80 scale-[1.01]'
                    : selectedFile
                    ? 'border-emerald-400 bg-emerald-50/40'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                }`}
              >
                <div className="max-w-md mx-auto space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner">
                    <FileUp className="w-7 h-7" />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {selectedFile ? selectedFile.name : 'Word (.docx) yoki PDF test faylini shu yerga tashlang'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      yoki kompyuteringizdan tanlash uchun bu yerga bosing
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 text-2xs font-semibold px-3 py-1 bg-white border border-slate-200 rounded-full text-slate-600 shadow-2xs">
                    <span>Qo'llab-quvvatlanadi:</span>
                    <strong className="text-blue-600 font-bold">.DOCX (Word)</strong>
                    <span>•</span>
                    <strong className="text-rose-600 font-bold">.PDF</strong>
                    <span>•</span>
                    <strong className="text-slate-600 font-bold">.TXT</strong>
                  </div>

                  {isReadingFile && (
                    <div className="pt-2">
                      <div className="flex items-center justify-center gap-2 text-xs font-semibold text-blue-700">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span>
                          Fayl o'qilmoqda va savollar tahlil qilinmoqda...
                          {readingProgress && readingProgress.total > 0 && ` (${readingProgress.current}/${readingProgress.total} sahifa)`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: Paste Raw Text */}
          {activeInputMode === 'text' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Test savollari matnini kiriting yoki tashlang:
              </label>
              <textarea
                value={rawPastedText}
                onChange={(e) => setRawPastedText(e.target.value)}
                placeholder={`Masalan:\n1. Alisher Navoiy qachon tug'ilgan?\nA) 1441-yil\nB) 1445-yil\nC) 1438-yil\nD) 1450-yil\nJavob: A\n\n2. «Dunyoning ishlari» qissasining muallifi kim?\nA) O'tkir Hoshimov\nB) Abdulla Qahhor\nC) Oybek\nD) G'afur G'ulom\nJavob: A`}
                rows={7}
                className="w-full text-xs sm:text-sm font-mono p-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 leading-relaxed"
              />
              <button
                type="button"
                onClick={handleManualTextParse}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 shadow-xs transition-all active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Matndagi Savollarni Ajratib Olish</span>
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Diqqat:</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Parsing Results / Preview */}
          {parsedQuestions.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-200">
              {/* Summary Stats */}
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-600 text-white rounded-lg">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950">
                      Muvaffaqiyatli ajratib olindi: {parsedQuestions.length} ta savol
                    </h4>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Barcha savol va variantlar to'liq O'zbek Lotin alifbosiga o'tkazildi.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-white rounded-lg text-2xs font-extrabold text-blue-700 border border-blue-200 shadow-2xs">
                    {mcCount} ta Variantli
                  </span>
                  <span className="px-2.5 py-1 bg-white rounded-lg text-2xs font-extrabold text-amber-700 border border-amber-200 shadow-2xs">
                    {wrCount} ta Yozma
                  </span>
                </div>
              </div>

              {/* Destination Selection */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Savollarni qayerga saqlaymiz?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDestinationMode('existing')}
                    disabled={books.length === 0}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      destinationMode === 'existing'
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-100'
                    } ${books.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <BookOpen className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Mavjud kitobga qo'shish</p>
                      <p className="text-2xs text-slate-500 mt-0.5">
                        Tanlangan kitobdagi testlar sonini to'ldiradi
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDestinationMode('new')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      destinationMode === 'new'
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-100'
                    }`}
                  >
                    <Plus className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Yangi kitob/test sifatida ochish</p>
                      <p className="text-2xs text-slate-500 mt-0.5">
                        Yangi alohida test to'plami yaratadi
                      </p>
                    </div>
                  </button>
                </div>

                {/* Destination Config Details */}
                {destinationMode === 'existing' && books.length > 0 && (
                  <div className="pt-2">
                    <label className="block text-2xs font-semibold text-slate-600 mb-1">
                      Kerakli kitobni tanlang:
                    </label>
                    <select
                      value={targetBookId}
                      onChange={(e) => setTargetBookId(e.target.value)}
                      className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      {books.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title} — {b.author || 'Noma\'lum muallif'} ({b.questions.length} ta savol mavjud)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {destinationMode === 'new' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">
                        Kitob / Test nomi *
                      </label>
                      <input
                        type="text"
                        value={newBookTitle}
                        onChange={(e) => setNewBookTitle(e.target.value)}
                        placeholder="Masalan: Dunyoning ishlari"
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">
                        Muallif (yozuvchi)
                      </label>
                      <input
                        type="text"
                        value={newBookAuthor}
                        onChange={(e) => setNewBookAuthor(e.target.value)}
                        placeholder="Masalan: O'tkir Hoshimov"
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">
                        Sinf
                      </label>
                      <select
                        value={newBookGrade}
                        onChange={(e) => setNewBookGrade(e.target.value)}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
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
                )}
              </div>

              {/* Questions Preview List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Eye className="w-4 h-4 text-slate-500" />
                    <span>Ajratib olingan savollar ko'rinishi ({filteredQuestions.length})</span>
                  </h4>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewTab('all')}
                      className={`px-2.5 py-1 rounded-lg text-2xs font-bold ${
                        previewTab === 'all'
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Barchasi ({parsedQuestions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('mc')}
                      className={`px-2.5 py-1 rounded-lg text-2xs font-bold ${
                        previewTab === 'mc'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Variantli ({mcCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('written')}
                      className={`px-2.5 py-1 rounded-lg text-2xs font-bold ${
                        previewTab === 'written'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Yozma ({wrCount})
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
                  {filteredQuestions.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white text-xs transition-colors relative group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <span className="font-mono font-bold text-blue-700 shrink-0">
                            {idx + 1}.
                          </span>
                          <div>
                            <span className="font-semibold text-slate-900">{q.question}</span>
                            <span
                              className={`ml-2 text-3xs font-extrabold px-1.5 py-0.5 rounded-full ${
                                q.type === 'multiple-choice'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {q.type === 'multiple-choice' ? 'Variantli' : 'Yozma'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(q.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-opacity"
                          title="Savolni olib tashlash"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {q.type === 'multiple-choice' && q.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2 pl-5">
                          {q.options.map((opt, optIdx) => {
                            const isCorrect = optIdx === q.correctOptionIndex;
                            const letter = String.fromCharCode(65 + optIdx);
                            return (
                              <div
                                key={optIdx}
                                className={`px-2 py-1 rounded-md text-2xs flex items-center gap-1.5 ${
                                  isCorrect
                                    ? 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-300'
                                    : 'bg-white text-slate-700 border border-slate-200'
                                }`}
                              >
                                <span className={isCorrect ? 'text-emerald-700' : 'text-slate-400'}>
                                  {letter})
                                </span>
                                <span className="truncate">{opt}</span>
                                {isCorrect && <Check className="w-3 h-3 text-emerald-600 ml-auto shrink-0" />}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {q.type === 'written' && (
                        <div className="mt-2 pl-5 text-2xs text-slate-600 bg-amber-50/60 p-2 rounded-lg border border-amber-200">
                          <span className="font-bold text-amber-900">Kutilayotgan javob: </span>
                          <span>{q.expectedAnswer}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {parsedQuestions.length > 0 ? (
              <span>
                Jami: <strong>{parsedQuestions.length} ta savol</strong> saqlashga tayyor
              </span>
            ) : (
              <span>Word yoki PDF fayl tanlang yoki matn nusxalab qo'ying</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Bekor qilish
            </button>

            <button
              type="button"
              disabled={parsedQuestions.length === 0 || isSubmitting}
              onClick={handleConfirmImport}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white flex items-center gap-2 transition-all shadow-sm ${
                parsedQuestions.length === 0 || isSubmitting
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saqlanmoqda...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {destinationMode === 'existing'
                      ? "Savollarni Tanlangan Kitobga Qo'shish"
                      : "Yangi Kitob Sifatida Saqlash"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
