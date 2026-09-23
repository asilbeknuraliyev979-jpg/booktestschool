import React from 'react';
import { BookOpen, Shield, GraduationCap, LogOut } from 'lucide-react';

interface HeaderProps {
  isAdmin: boolean;
  onAdminClick: () => void;
  onExitAdmin: () => void;
  studentName?: string;
  studentGrade?: string;
  isLiveConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isAdmin,
  onAdminClick,
  onExitAdmin,
  studentName,
  studentGrade,
  isLiveConnected = true,
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
          {/* Global Real-Time Live Status Indicator */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
              isLiveConnected
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
            title={
              isLiveConnected
                ? "Barcha kompyuterlar bilan markaziy server orqali real vaqtda ulangan (Global Real-time)"
                : "Serverga qayta ulanmoqda..."
            }
          >
            {isLiveConnected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="hidden md:inline">Global:</span>
                <span className="font-bold">Real-time</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span className="hidden sm:inline">Ulanmoqda...</span>
              </>
            )}
          </div>

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
              {studentGrade && (
                <span className="text-blue-600 font-medium">
                  ({studentGrade.includes('sinf') ? studentGrade : `${studentGrade} sinf`})
                </span>
              )}
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
