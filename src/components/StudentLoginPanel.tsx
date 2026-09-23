import React from 'react';
import { User, School, CheckCircle2, ArrowRight } from 'lucide-react';
import { StudentInfo, SCHOOL_GRADES, CLASS_LETTERS, ALL_SCHOOL_CLASSES } from '../types';

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
  // Parse current grade e.g. "8-A" -> num: "8", letter: "A"
  const currentGradeMatch = studentInfo.grade.match(/^(\d+)-([ABD])$/i);
  const selectedNum = currentGradeMatch ? currentGradeMatch[1] : '';
  const selectedLetter = currentGradeMatch ? currentGradeMatch[2].toUpperCase() : '';

  const handleSelectNumber = (num: string) => {
    const letter = selectedLetter || 'A';
    onChange({ ...studentInfo, grade: `${num}-${letter}` });
  };

  const handleSelectLetter = (letter: string) => {
    const num = selectedNum || '5';
    onChange({ ...studentInfo, grade: `${num}-${letter}` });
  };

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
          Iltimos, ism-familiyangiz va sinfingizni tanlang.
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

        {/* Sinf Tanlash (5-A, 5-B, 5-D ... 11-A, 11-B, 11-D) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-semibold text-slate-800">
              Sinfingiz:
            </label>
            {studentInfo.grade && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                {studentInfo.grade} sinf
              </span>
            )}
          </div>

          {/* Dropdown Selector */}
          <div className="relative mb-3">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <School className="w-5 h-5" />
            </div>
            <select
              value={studentInfo.grade}
              onChange={(e) =>
                onChange({ ...studentInfo, grade: e.target.value })
              }
              className="w-full pl-11 pr-8 py-2.5 rounded-xl border border-slate-300 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 text-sm font-medium bg-white transition-all cursor-pointer"
            >
              <option value="">-- Sinfingizni tanlang --</option>
              {SCHOOL_GRADES.map((g) => (
                <optgroup key={g} label={`${g}-sinflar`}>
                  {CLASS_LETTERS.map((letter) => {
                    const classId = `${g}-${letter}`;
                    return (
                      <option key={classId} value={classId}>
                        {classId} sinf
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Tezkor tanlash (Quick Pick): 1. Raqam, 2. Harf (faqat A, B, D) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                1. Sinf raqami (5 dan 11 gacha):
              </span>
              <div className="grid grid-cols-7 gap-1">
                {SCHOOL_GRADES.map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleSelectNumber(num)}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all text-center ${
                      selectedNum === num
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                2. Sinf harfi (faqat A, B, D):
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {CLASS_LETTERS.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => handleSelectLetter(letter)}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all text-center ${
                      selectedLetter === letter
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {letter} guruhi
                  </button>
                ))}
              </div>
            </div>
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
                  Ma'lumotlar tayyor: {studentInfo.fullName} ({studentInfo.grade} sinf)
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
                  Ism va sinfni to'liq kiriting
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {!studentInfo.fullName.trim() && !studentInfo.grade
                    ? "Ism-familiyangizni yozing va sinfingizni (5-A dan 11-D gacha) tanlang."
                    : !studentInfo.fullName.trim()
                    ? "Iltimos, ism va familiyangizni kiriting."
                    : "Iltimos, sinfingizni tanlang (Masalan: 8-A sinf)."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
