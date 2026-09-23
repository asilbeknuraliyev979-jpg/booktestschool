import React, { useState } from 'react';
import { BookOpen, HelpCircle, FileText, Play, CheckCircle, Lock, AlertCircle } from 'lucide-react';
import { Book, TestDeliveryConfig } from '../types';

interface BookTestListProps {
  books: Book[];
  deliveryConfig: TestDeliveryConfig;
  isStudentReady: boolean;
  onStartTest: (book: Book) => void;
  onNeedStudentInfo: () => void;
}

export const BookTestList: React.FC<BookTestListProps> = ({
  books,
  deliveryConfig,
  isStudentReady,
  onStartTest,
  onNeedStudentInfo,
}) => {
  const [inactiveNotice, setInactiveNotice] = useState<string | null>(null);

  const activeBooksCount = books.filter((b) => b.isActive !== false).length;

  return (
    <div className="space-y-4">
      {inactiveNotice && (
        <div className="p-4 bg-rose-50 border-2 border-rose-300 text-rose-800 text-xs sm:text-sm rounded-2xl font-medium flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{inactiveNotice}</span>
          </div>
          <button
            onClick={() => setInactiveNotice(null)}
            className="text-xs px-2.5 py-1 bg-rose-200/60 hover:bg-rose-200 text-rose-900 rounded-lg font-bold"
          >
            Yopish
          </button>
        </div>
      )}

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span>Mavjud Kitob Testlari</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            O'qigan kitobingizni tanlang va bilimingizni sinab ko'ring
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{activeBooksCount} ta test faol (Start)</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
            <span>Har bir testda:</span>
            <span className="font-bold text-blue-600">
              {deliveryConfig.totalQuestions} ta savol
            </span>
            <span className="text-slate-400">({deliveryConfig.multipleChoiceCount} variantli, {deliveryConfig.writtenCount} yozma)</span>
          </div>
        </div>
      </div>

      {/* Book Cards */}
      {books.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-base text-slate-700">Hozircha kitoblar mavjud emas</p>
          <p className="text-xs text-slate-400 mt-1">
            Admin panel orqali yangi kitob va test savollarini qo'shishingiz mumkin.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {books.map((book) => {
            const mcCount = book.questions.filter((q) => q.type === 'multiple-choice').length;
            const writtenCount = book.questions.filter((q) => q.type === 'written').length;
            const isActive = book.isActive !== false;

            return (
              <div
                key={book.id}
                className={`bg-white rounded-2xl border transition-all p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 group ${
                  isActive
                    ? 'border-slate-200/90 shadow-xs hover:shadow-md'
                    : 'border-slate-200 bg-slate-50/60 opacity-90'
                }`}
              >
                {/* Book Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                      {book.grade}
                    </span>
                    <span className="text-xs text-slate-500">
                      Muallif: <strong className="text-slate-700 font-semibold">{book.author}</strong>
                    </span>

                    {/* Active / Inactive Status Badge */}
                    {isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-2xs font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Faol (Start)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-2xs font-extrabold uppercase tracking-wider bg-slate-200 text-slate-700 border border-slate-300 rounded-full">
                        <Lock className="w-3 h-3 text-slate-500" />
                        Nofaol / Yopiq (Finish)
                      </span>
                    )}
                  </div>

                  <h3 className={`text-lg sm:text-xl font-bold transition-colors ${
                    isActive ? 'text-slate-900 group-hover:text-blue-600' : 'text-slate-600'
                  }`}>
                    {book.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                    {book.description}
                  </p>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                      <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                      <span>{mcCount} ta variantli baza</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{writtenCount} ta yozma baza</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Random tanlanadi: {deliveryConfig.multipleChoiceCount} variantli + {deliveryConfig.writtenCount} yozma
                    </span>
                  </div>
                </div>

                {/* Action button */}
                <div className="md:shrink-0 flex items-center">
                  {isActive ? (
                    <button
                      onClick={() => {
                        if (!isStudentReady) {
                          onNeedStudentInfo();
                        } else {
                          // Immediately request fullscreen on user click gesture as requested
                          try {
                            const elem = document.documentElement as any;
                            if (elem.requestFullscreen) {
                              elem.requestFullscreen().catch(() => {});
                            } else if (elem.webkitRequestFullscreen) {
                              elem.webkitRequestFullscreen();
                            }
                          } catch {
                            // Ignore if denied by browser
                          }
                          onStartTest(book);
                        }
                      }}
                      className={`w-full md:w-auto px-5 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                        isStudentReady
                          ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                      }`}
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Testni topshirish</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setInactiveNotice(
                          `"${book.title}" kitobi bo'yicha test hozirda nofaol (Finish) qilingan. O'qituvchi testni faollashtirmaguncha (Start) uni topshirib bo'lmaydi.`
                        );
                      }}
                      className="w-full md:w-auto px-5 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 bg-slate-200/80 hover:bg-slate-300/80 text-slate-600 border border-slate-300 transition-all cursor-pointer"
                      title="Ushbu test o'qituvchi tomonidan vaqtincha to'xtatilgan yoki yakunlangan"
                    >
                      <Lock className="w-4 h-4 text-slate-500" />
                      <span>Test nofaol (Finish qilingan)</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
