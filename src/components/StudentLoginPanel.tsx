import React from 'react';
import { User, School, CheckCircle2, ArrowRight } from 'lucide-react';
import { StudentInfo } from '../types';

interface StudentLoginPanelProps {
  studentInfo: StudentInfo;
  onChange: (info: StudentInfo) => void;
  isReady: boolean;
}

export const StudentLoginPanel: React.FC<StudentLoginPanelProps> = ({
  studentInfo,
  onChange,
  isReady,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-7 sticky top-24">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold rounded-full mb-3">
          <User className="w-3.5 h-3.5" />
          <span>O'quvchi ma'lumotlari</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          O'quvchini ro'yxatga olish
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Iltimos, ism-familiyangiz va sinfingizni kiriting.
        </p>
      </div>

      <div className="space-y-5">
        {/* Ism Familiya Input */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">
            Ism va Familiyangiz:
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <User className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={studentInfo.fullName}
              onChange={(e) =>
                onChange({ ...studentInfo, fullName: e.target.value })
              }
              placeholder="Masalan: Azizbek Karimov"
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 text-sm font-medium transition-all"
            />
          </div>
        </div>

        {/* Sinf Input */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">
            Sinfingiz:
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <School className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={studentInfo.grade}
              onChange={(e) =>
                onChange({ ...studentInfo, grade: e.target.value })
              }
              placeholder="Masalan: 8-A sinf"
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 text-sm font-medium transition-all"
            />
          </div>

          {/* Quick Grade Pills */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {['5-sinf', '6-sinf', '7-sinf', '8-sinf', '9-sinf', '10-sinf', '11-sinf'].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => onChange({ ...studentInfo, grade: g })}
                className={`px-2 py-0.5 text-xs rounded-lg border transition-all ${
                  studentInfo.grade === g
                    ? 'bg-blue-600 border-blue-600 text-white font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Status Indicator */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            isReady
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
              : 'bg-amber-50/80 border-amber-200 text-amber-800'
          }`}
        >
          {isReady ? (
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-900">
                  Ma'lumotlar to'ldirildi!
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Endi o'ng tomondagi mavjud kitoblardan birini tanlab, testni boshlashingiz mumkin.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5">
              <ArrowRight className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-900">
                  Ism va sinfni kiriting
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Test natijalaringiz hisobotga tushishi uchun ikkala maydonni ham to'ldiring.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
