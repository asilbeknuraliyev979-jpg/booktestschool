import React from 'react';
import { BookOpen, Shield, GraduationCap, LogOut } from 'lucide-react';

interface HeaderProps {
  isAdmin: boolean;
  onAdminClick: () => void;
  onExitAdmin: () => void;
  studentName?: string;
  studentGrade?: string;
}

export const Header: React.FC<HeaderProps> = ({
  isAdmin,
  onAdminClick,
  onExitAdmin,
  studentName,
  studentGrade,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 text-lg tracking-tight">
                Maktab Kitob Testlari
              </span>
              {isAdmin && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-md border border-amber-300">
                  Admin Rejimi
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              O'qilgan kitoblar bo'yicha mustaqil bilim sinovi
            </p>
          </div>
        </div>

        {/* Right Action */}
        <div className="flex items-center gap-2 sm:gap-3">
          {!isAdmin && (
            <button
              id="admin-header-link"
              type="button"
              onClick={onAdminClick}
              className="text-[11px] font-mono font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-100 px-2 py-0.5 rounded transition-colors tracking-tight cursor-pointer"
              title="Admin tizimiga kirish"
            >
              admin
            </button>
          )}

          {!isAdmin && studentName && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
              <GraduationCap className="w-4 h-4 text-blue-600" />
              <span className="font-semibold">{studentName}</span>
              <span className="text-blue-500 font-normal">({studentGrade})</span>
            </div>
          )}

          {isAdmin && (
            <button
              onClick={onExitAdmin}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all shadow-2xs"
              title="Admin rejimidan chiqish va o'quvchi oynasiga qaytish"
            >
              <LogOut className="w-4 h-4" />
              <span>Chiqish (O'quvchi oynasi)</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
