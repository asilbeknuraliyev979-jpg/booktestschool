import React from 'react';
import { BookOpen, HelpCircle, FileText, Play, CheckCircle } from 'lucide-react';
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
  return (
    <div className="space-y-4">
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
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
          <span>Har bir testda:</span>
          <span className="font-bold text-blue-600">
            {deliveryConfig.totalQuestions} ta savol
          </span>
          <span className="text-slate-400">({deliveryConfig.multipleChoiceCount} variantli, {deliveryConfig.writtenCount} yozma)</span>
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

            return (
              <div
                key={book.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 group"
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
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
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
                  <button
                    onClick={() => {
                      if (!isStudentReady) {
                        onNeedStudentInfo();
                      } else {
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
