import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Clock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileEdit,
  Send,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Loader2,
  Bot,
  Maximize2,
  Minimize2,
  ShieldAlert,
  AlertOctagon,
  EyeOff,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Book,
  StudentInfo,
  TestDeliveryConfig,
  Question,
  StudentTestResult,
  QuestionResultDetail,
} from '../types';

interface StudentQuizViewProps {
  book: Book;
  studentInfo: StudentInfo;
  deliveryConfig: TestDeliveryConfig;
  onComplete: (result: StudentTestResult) => void;
  onCancel: () => void;
}

export const StudentQuizView: React.FC<StudentQuizViewProps> = ({
  book,
  studentInfo,
  deliveryConfig,
  onComplete,
  onCancel,
}) => {
  // Select randomized questions on initial mount
  const selectedQuestions = useMemo(() => {
    const mcPool = book.questions.filter((q) => q.type === 'multiple-choice');
    const writtenPool = book.questions.filter((q) => q.type === 'written');

    // Shuffle helper
    const shuffle = <T,>(arr: T[]): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const shuffledMC = shuffle(mcPool).slice(0, deliveryConfig.multipleChoiceCount);
    const shuffledWritten = shuffle(writtenPool).slice(0, deliveryConfig.writtenCount);

    return [...shuffledMC, ...shuffledWritten];
  }, [book, deliveryConfig]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [mcAnswers, setMcAnswers] = useState<Record<string, number>>({});
  const [writtenAnswers, setWrittenAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(deliveryConfig.timeLimitMinutes * 60);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isEvaluatingWithAI, setIsEvaluatingWithAI] = useState(false);
  const [result, setResult] = useState<StudentTestResult | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Fullscreen and anti-cheat states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [terminatedDueToTabSwitch, setTerminatedDueToTabSwitch] = useState(false);
  const [securityToast, setSecurityToast] = useState<string | null>(null);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarningModal, setShowTabWarningModal] = useState(false);

  // Synchronous refs for event listeners
  const mcAnswersRef = useRef<Record<string, number>>({});
  const writtenAnswersRef = useRef<Record<string, string>>({});
  const isSubmittedRef = useRef(false);
  const timeLeftRef = useRef(deliveryConfig.timeLimitMinutes * 60);
  const tabSwitchCountRef = useRef(0);

  mcAnswersRef.current = mcAnswers;
  writtenAnswersRef.current = writtenAnswers;
  isSubmittedRef.current = isSubmitted;
  timeLeftRef.current = timeLeft;
  tabSwitchCountRef.current = tabSwitchCount;

  // 1. FULLSCREEN HELPER FUNCTIONS
  const enterFullscreen = useCallback(async () => {
    try {
      const elem = document.documentElement as any;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
    } catch {
      // Browser might require direct user gesture or deny inside sandboxed frame
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      const doc = document as any;
      if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch {
      // Ignore cleanup error
    }
  }, []);

  // Attempt automatic fullscreen upon mount
  useEffect(() => {
    enterFullscreen();

    const handleFullscreenChange = () => {
      const doc = document as any;
      const active = Boolean(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(active);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      exitFullscreen();
    };
  }, [enterFullscreen, exitFullscreen]);

  // Security toast timer
  useEffect(() => {
    if (!securityToast) return;
    const timer = setTimeout(() => {
      setSecurityToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [securityToast]);

  // Timer countdown
  useEffect(() => {
    if (isSubmitted) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitQuiz('timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isSubmitted]);

  const currentQ = selectedQuestions[currentIndex];

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Check written answer similarity
  const evaluateWrittenAnswer = (studentAnswer: string, expectedAnswer = '', keywords: string[] = []): boolean => {
    const cleanStudent = studentAnswer.trim().toLowerCase();
    if (!cleanStudent) return false;

    // Check exact or partial match
    const cleanExpected = expectedAnswer.toLowerCase();
    if (cleanStudent === cleanExpected || cleanExpected.includes(cleanStudent) || cleanStudent.includes(cleanExpected)) {
      return true;
    }

    // Check keywords
    if (keywords && keywords.length > 0) {
      const matched = keywords.some((kw) => cleanStudent.includes(kw.toLowerCase().trim()));
      if (matched) return true;
    }

    return false;
  };

  // Submit test with AI evaluation for written answers
  const handleSubmitQuiz = useCallback(async (reason: 'normal' | 'timeout' | 'tab_switch' = 'normal') => {
    if (isSubmittedRef.current) return;
    isSubmittedRef.current = true;
    setIsSubmitted(true);
    setShowConfirmModal(false);

    if (reason === 'tab_switch') {
      setTerminatedDueToTabSwitch(true);
    }

    // Exit fullscreen cleanly upon submission
    exitFullscreen();

    const currentMc = mcAnswersRef.current;
    const currentWritten = writtenAnswersRef.current;
    const currentRemainingTime = timeLeftRef.current;

    setIsEvaluatingWithAI(true);

    const writtenQuestions = selectedQuestions.filter((q) => q.type === 'written');
    let aiEvaluationMap: Record<string, { isAccepted: boolean; feedback: string }> = {};

    if (writtenQuestions.length > 0) {
      try {
        const payloadEvaluations = writtenQuestions.map((q) => ({
          questionId: q.id,
          question: q.question,
          expectedAnswer: q.expectedAnswer || '',
          studentAnswer: currentWritten[q.id] || '',
          keywords: q.keywords || [],
        }));

        const response = await fetch('/api/evaluate-written-answers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookTitle: book.title,
            evaluations: payloadEvaluations,
          }),
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.success && Array.isArray(resData.evaluations)) {
            resData.evaluations.forEach((item: any) => {
              aiEvaluationMap[item.questionId] = {
                isAccepted: !!item.isAccepted,
                feedback: item.feedback,
              };
            });
          }
        }
      } catch (err) {
        console.warn('AI evaluation fetch failed, fallback to local logic:', err);
      }
    }

    let mcCorrect = 0;
    let writtenCorrect = 0;
    const details: QuestionResultDetail[] = [];

    selectedQuestions.forEach((q) => {
      if (q.type === 'multiple-choice') {
        const studentChoiceIndex = currentMc[q.id];
        const isCorrect = studentChoiceIndex === q.correctOptionIndex;
        if (isCorrect) mcCorrect++;

        const studentAnswerText =
          studentChoiceIndex !== undefined && q.options
            ? `${String.fromCharCode(65 + studentChoiceIndex)}) ${q.options[studentChoiceIndex]}`
            : "Javob berilmadi";

        const correctAnswerText =
          q.correctOptionIndex !== undefined && q.options
            ? `${String.fromCharCode(65 + q.correctOptionIndex)}) ${q.options[q.correctOptionIndex]}`
            : "";

        details.push({
          questionId: q.id,
          questionText: q.question,
          type: 'multiple-choice',
          studentAnswer: studentAnswerText,
          correctAnswer: correctAnswerText,
          isCorrect,
          explanation: q.explanation,
        });
      } else {
        const studentText = currentWritten[q.id] || '';
        let isCorrect = false;
        let aiFeedback = '';

        if (aiEvaluationMap[q.id]) {
          isCorrect = aiEvaluationMap[q.id].isAccepted;
          aiFeedback = aiEvaluationMap[q.id].feedback;
        } else {
          isCorrect = evaluateWrittenAnswer(studentText, q.expectedAnswer, q.keywords);
          aiFeedback = isCorrect
            ? "Javobingiz to'g'ri javobga mazmunan yaqin deb qabul qilindi."
            : "Javobingiz kutilgan javob bilan to'liq mos kelmadi.";
        }

        if (isCorrect) writtenCorrect++;

        details.push({
          questionId: q.id,
          questionText: q.question,
          type: 'written',
          studentAnswer: studentText || "Javob yozilmadi",
          correctAnswer: q.expectedAnswer || "",
          isCorrect,
          explanation: q.explanation,
          aiFeedback,
        });
      }
    });

    const totalQuestions = selectedQuestions.length;
    const totalScore = mcCorrect + writtenCorrect;
    const percentage = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

    let gradeBadge: StudentTestResult['gradeBadge'] = "2 (Qoniqarsiz)";
    if (percentage >= 86) gradeBadge = "5 (A'lo)";
    else if (percentage >= 71) gradeBadge = "4 (Yaxshi)";
    else if (percentage >= 56) gradeBadge = "3 (Qoniqarli)";

    const testDuration = deliveryConfig.timeLimitMinutes * 60 - currentRemainingTime;

    const testResult: StudentTestResult = {
      id: `res-${Date.now()}`,
      studentName: studentInfo.fullName,
      studentGrade: studentInfo.grade,
      bookId: book.id,
      bookTitle: book.title,
      score: totalScore,
      totalQuestions,
      percentage,
      multipleChoiceCorrect: mcCorrect,
      multipleChoiceTotal: deliveryConfig.multipleChoiceCount,
      writtenCorrect,
      writtenTotal: deliveryConfig.writtenCount,
      durationSeconds: testDuration > 0 ? testDuration : 1,
      completedAt: new Date().toISOString(),
      submittedAt: Date.now(),
      gradeBadge,
      terminatedReason: reason,
      details,
    };

    setIsEvaluatingWithAI(false);
    setResult(testResult);
    onComplete(testResult);

    if (percentage >= 70 && reason !== 'tab_switch') {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [book, deliveryConfig, exitFullscreen, onComplete, selectedQuestions, studentInfo]);

  // 2. ANTI-CHEAT: TAB SWITCH DETECTION (1-marta ogohlantirish, 2-marta birdaniga to'xtatish)
  useEffect(() => {
    if (isSubmitted) return;

    let lastSwitchTime = 0;

    const handleTabViolation = () => {
      if (isSubmittedRef.current) return;
      const now = Date.now();
      // Debounce window blur + visibilitychange firing simultaneously (within 800ms)
      if (now - lastSwitchTime < 800) return;
      lastSwitchTime = now;

      const currentCount = tabSwitchCountRef.current + 1;
      tabSwitchCountRef.current = currentCount;
      setTabSwitchCount(currentCount);

      if (currentCount === 1) {
        // 1-marta qoidabuzarlik: Jiddiy ogohlantirish modalini chiqarish
        setShowTabWarningModal(true);
      } else if (currentCount >= 2) {
        // 2-marta qoidabuzarlik: Birdaniga testni to'xtatish va chiqarib yuborish
        setShowTabWarningModal(false);
        handleSubmitQuiz('tab_switch');
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        handleTabViolation();
      }
    };

    const handleWindowBlur = () => {
      // If student clicks away to another app or changes tab
      handleTabViolation();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isSubmitted, handleSubmitQuiz]);

  // 3. ANTI-CHEAT: PREVENT F12, DEVTOOLS SHORTCUTS, RIGHT-CLICK & COPYING
  // "keyin f12 tugmasini ham bosish imkoni bo'lmasin"
  useEffect(() => {
    if (isSubmitted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Block F12 (keyCode 123)
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        setSecurityToast("⚠️ Diqqat! F12 (Dasturchi vositalari) bloklangan!");
        return false;
      }

      // 2. Block Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+Shift+K, Cmd+Option+I/J/C
      const isModifierShift = (e.ctrlKey || e.metaKey) && e.shiftKey;
      if (isModifierShift && ['I', 'J', 'C', 'K', 'i', 'j', 'c', 'k'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        setSecurityToast("⚠️ Dasturchi konsoli va inspektorni ochish taqiqlangan!");
        return false;
      }

      // 3. Block Ctrl+U / Cmd+Option+U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        setSecurityToast("⚠️ Sahifa manba kodini ochish taqiqlangan!");
        return false;
      }

      // 4. Block Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Block right-click context menu during test
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setSecurityToast("⚠️ Test davomida sichqonchaning o'ng tugmasi (kontekst menyu) bloklangan!");
      return false;
    };

    // Block copying text from question cards during test
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      setSecurityToast("⚠️ Test savollarini nusxalash (copy qilish) taqiqlangan!");
      return false;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('copy', handleCopy, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('copy', handleCopy, true);
    };
  }, [isSubmitted]);

  const answeredCount =
    Object.keys(mcAnswers).length +
    Object.values(writtenAnswers).filter((v) => v.trim().length > 0).length;

  if (selectedQuestions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-xl mx-auto">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900">Savollar yetarli emas</h3>
        <p className="text-sm text-slate-600 mt-1">
          Ushbu kitobda hali savollar bazasi to'liq shakllantirilmagan.
        </p>
        <button
          onClick={onCancel}
          className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium"
        >
          Orqaga qaytish
        </button>
      </div>
    );
  }

  // RESULT VIEW
  if (isSubmitted && result) {
    const isTabSwitched = result.terminatedReason === 'tab_switch' || terminatedDueToTabSwitch;

    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
        {/* Anti-Cheat Tab Switch Warning Banner */}
        {isTabSwitched && (
          <div className="bg-red-600 text-white p-5 sm:p-6 rounded-2xl shadow-xl border-2 border-red-400 flex items-start gap-4 animate-in slide-in-from-top-4 duration-300">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
              <AlertOctagon className="w-7 h-7 text-white animate-pulse" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-md bg-white text-red-700 font-extrabold text-xs uppercase tracking-wider">
                Qoidabuzarlik: Test To'xtatildi
              </span>
              <h2 className="text-lg sm:text-xl font-black tracking-tight mt-1.5">
                Boshqa Tabga 2 Marta O'tganlik Sababli Test Darhol Yakunlandi!
              </h2>
              <p className="text-sm text-red-100 mt-1 leading-relaxed">
                Platforma xavfsizlik tizimi test davomida 2 marta brauzerdagi boshqa sahifaga (tabga) yoki boshqa dasturga o'tilganini qayd etdi (1-marta ogohlantirilgan edi). Qoidalarga muvofiq test majburiy to'xtatildi va siz kiritgan javoblar shu holatida yakuniy hisobotga saqlandi.
              </p>
            </div>
          </div>
        )}

        {/* Result Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className={`p-6 sm:p-8 text-center text-white ${
            isTabSwitched
              ? 'bg-gradient-to-r from-red-800 to-slate-900'
              : 'bg-gradient-to-r from-blue-700 to-indigo-800'
          }`}>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-xs rounded-full text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isTabSwitched ? "Test majburiy yakunlandi" : "Test yakunlandi"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {studentInfo.fullName}
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              {studentInfo.grade} • Kitob: <strong>"{book.title}"</strong>
            </p>

            {/* Score Display */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-8">
              <div className="bg-white/10 backdrop-blur-xs rounded-xl px-5 py-3 border border-white/20 text-center">
                <div className="text-3xl sm:text-4xl font-black">{result.score} / {result.totalQuestions}</div>
                <div className="text-xs text-blue-200 uppercase tracking-wider font-semibold mt-1">
                  Umumiy Ball
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-xs rounded-xl px-5 py-3 border border-white/20 text-center">
                <div className="text-3xl sm:text-4xl font-black">{result.percentage}%</div>
                <div className="text-xs text-blue-200 uppercase tracking-wider font-semibold mt-1">
                  O'zlashtirish
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-xs rounded-xl px-5 py-3 border border-white/20 text-center">
                <div className="text-2xl sm:text-3xl font-black text-amber-300">{result.gradeBadge}</div>
                <div className="text-xs text-blue-200 uppercase tracking-wider font-semibold mt-1">
                  Baho
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-blue-200">
              <span>Variantli test: <strong>{result.multipleChoiceCorrect} / {result.multipleChoiceTotal}</strong></span>
              <span>•</span>
              <span>Yozma savol: <strong>{result.writtenCorrect} / {result.writtenTotal}</strong></span>
              <span>•</span>
              <span>Sarflangan vaqt: <strong>{Math.floor(result.durationSeconds / 60)} daq {result.durationSeconds % 60} son</strong></span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Natija admin hisobotiga to'liq saqlandi
            </span>
            <button
              onClick={onCancel}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-xs"
            >
              Bosh sahifaga qaytish
            </button>
          </div>
        </div>

        {/* Question by question review */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Savollar tahlili va to'g'ri javoblar:</span>
          </h2>

          <div className="space-y-3">
            {result.details.map((detail, idx) => (
              <div
                key={detail.questionId}
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  detail.isCorrect
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-red-50/70 border-red-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                        detail.isCorrect
                          ? 'bg-emerald-600 text-white'
                          : 'bg-red-600 text-white'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 bg-white/70 px-2 py-0.5 rounded border border-slate-200">
                        {detail.type === 'multiple-choice' ? 'Variantli' : 'Yozma'}
                      </span>
                      <h3 className="text-sm sm:text-base font-semibold text-slate-900 mt-1">
                        {detail.questionText}
                      </h3>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {detail.isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        To'g'ri
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700 font-bold text-xs bg-red-100 px-2.5 py-1 rounded-full border border-red-300">
                        <XCircle className="w-3.5 h-3.5" />
                        Xato
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 font-medium block mb-0.5">
                      Sizning javobingiz:
                    </span>
                    <p
                      className={`font-semibold p-2 rounded-lg ${
                        detail.isCorrect
                          ? 'bg-emerald-100/70 text-emerald-900'
                          : 'bg-red-100/70 text-red-900'
                      }`}
                    >
                      {detail.studentAnswer || "Javob berilmadi"}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500 font-medium block mb-0.5">
                      Kutilgan to'g'ri javob:
                    </span>
                    <p className="font-semibold p-2 rounded-lg bg-white text-slate-800 border border-slate-200">
                      {detail.correctAnswer}
                    </p>
                  </div>
                </div>

                {detail.aiFeedback && (
                  <div className="mt-2.5 text-xs text-slate-700 bg-white/90 p-2.5 rounded-lg border border-slate-200 flex items-start gap-2">
                    <Bot className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-blue-900">AI Tekshiruv Xulosasi: </strong>
                      <span>{detail.aiFeedback}</span>
                    </div>
                  </div>
                )}

                {detail.explanation && (
                  <div className="mt-2 text-2xs text-slate-500">
                    <strong>Izoh:</strong> {detail.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pt-4 text-center">
            <button
              onClick={onCancel}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
            >
              Bosh sahifaga qaytish
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE TEST TAKING VIEW (Protected with Fullscreen & Anti-Cheat)
  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-16 select-none">
      {/* Security Toast Notification */}
      {securityToast && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 p-4 bg-red-600 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-2xl border-2 border-white/30 flex items-center gap-3 animate-in slide-in-from-top-4 duration-200">
          <ShieldAlert className="w-6 h-6 text-white shrink-0 animate-bounce" />
          <span className="flex-1 leading-snug">{securityToast}</span>
          <button
            onClick={() => setSecurityToast(null)}
            className="text-white/80 hover:text-white text-lg font-black ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Test Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
              {studentInfo.grade}
            </span>
            {isFullscreen ? (
              <span className="inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                To'liq ekran faol
              </span>
            ) : (
              <button
                type="button"
                onClick={enterFullscreen}
                className="inline-flex items-center gap-1 text-2xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-md transition-colors"
                title="To'liq ekranga o'tish"
              >
                <Maximize2 className="w-3 h-3 text-amber-600" />
                To'liq ekranga o'tish
              </button>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
            "{book.title}" bo'yicha test
          </h2>
          <p className="text-xs text-slate-500">
            O'quvchi: <strong>{studentInfo.fullName}</strong>
          </p>
        </div>

        {/* Timer, Fullscreen Toggle and Submit */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={isFullscreen ? exitFullscreen : enterFullscreen}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 hidden sm:flex items-center justify-center"
            title={isFullscreen ? "To'liq ekrandan chiqish" : "To'liq ekranga o'tish"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2 px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 font-mono font-bold text-sm sm:text-base">
            <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
            <span>{formatTime(timeLeft)}</span>
          </div>

          <button
            onClick={() => setShowConfirmModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Yakunlash</span>
          </button>
        </div>
      </div>

      {/* Anti-Cheat Notice Warning Bar */}
      <div className="px-4 py-2.5 bg-amber-50/90 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
        <div className="flex items-center gap-2 font-medium">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Anti-cheat himoyasi:</strong> Boshqa sahifa yoki tabga o'tilsa, test darhol to'xtatiladi va natijangiz saqlanadi!
          </span>
        </div>
        <span className="hidden md:inline text-amber-700 font-mono text-2xs">F12 taqiqlangan</span>
      </div>

      {/* Stepper / Question Numbers */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-2.5">
          <span>
            Savol <strong>{currentIndex + 1}</strong> / {selectedQuestions.length}
          </span>
          <span>
            Javob berildi: <strong>{answeredCount}</strong> / {selectedQuestions.length}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {selectedQuestions.map((q, idx) => {
            const isAnswered =
              q.type === 'multiple-choice'
                ? mcAnswers[q.id] !== undefined
                : (writtenAnswers[q.id] || '').trim().length > 0;
            const isCurrent = idx === currentIndex;

            return (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(idx)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/40'
                    : isAnswered
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Question Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b pb-3 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
              {currentIndex + 1}
            </span>
            <span className="font-semibold uppercase tracking-wider text-slate-700">
              {currentQ.type === 'multiple-choice' ? 'Variantli Savol' : 'Javob Yoziladigan Savol'}
            </span>
          </div>
          <span className="text-slate-400">
            {currentQ.type === 'multiple-choice' ? '1 ta to\'g\'ri variant' : 'Matnli aniq javob yozing'}
          </span>
        </div>

        {/* Question Text */}
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
          {currentQ.question}
        </h3>

        {/* Multiple Choice Options */}
        {currentQ.type === 'multiple-choice' && currentQ.options && (
          <div className="grid grid-cols-1 gap-3 pt-2">
            {currentQ.options.map((optText, optIdx) => {
              const letter = String.fromCharCode(65 + optIdx); // A, B, C, D
              const isSelected = mcAnswers[currentQ.id] === optIdx;

              return (
                <button
                  key={optIdx}
                  onClick={() =>
                    setMcAnswers({ ...mcAnswers, [currentQ.id]: optIdx })
                  }
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                    isSelected
                      ? 'bg-blue-50/90 border-blue-600 shadow-xs ring-1 ring-blue-500'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/80 hover:border-slate-300'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-slate-300 text-slate-700'
                    }`}
                  >
                    {letter}
                  </span>
                  <span
                    className={`text-sm sm:text-base font-medium mt-0.5 ${
                      isSelected ? 'text-blue-950 font-semibold' : 'text-slate-800'
                    }`}
                  >
                    {optText}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Written Question Input */}
        {currentQ.type === 'written' && (
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-semibold text-slate-600">
              O'z javobingizni quyida batafsil va tushunarli yozing:
            </label>
            <textarea
              rows={4}
              value={writtenAnswers[currentQ.id] || ''}
              onChange={(e) =>
                setWrittenAnswers({
                  ...writtenAnswers,
                  [currentQ.id]: e.target.value,
                })
              }
              placeholder="Javobingizni shu yerga kiriting..."
              className="w-full p-4 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-slate-900 text-sm leading-relaxed focus:outline-none transition-all"
            />
            <p className="text-2xs text-slate-400">
              💡 Maslahat: Asosiy qahramonlar, voqealar va muallif g'oyasiga oid muhim so'zlarni aniq ifodalang. AI sun'iy intellekti javobingiz mazmunini avtomatik tahlil qiladi.
            </p>
          </div>
        )}

        {/* Navigation Buttons between questions */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-200">
          <button
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Oldingi savol</span>
          </button>

          {currentIndex < selectedQuestions.length - 1 ? (
            <button
              onClick={() =>
                setCurrentIndex((prev) =>
                  Math.min(selectedQuestions.length - 1, prev + 1)
                )
              }
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs sm:text-sm hover:bg-blue-700 active:scale-95 transition-all shadow-xs"
            >
              <span>Keyingi savol</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setShowConfirmModal(true)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs sm:text-sm hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
            >
              <span>Testni yakunlash</span>
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Evaluating with AI Overlay */}
      {isEvaluatingWithAI && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
            <div>
              <h4 className="font-bold text-slate-900 text-base">Natijalar baholanmoqda</h4>
              <p className="text-xs text-slate-500 mt-1">
                Yozma javoblaringiz sun'iy intellekt (AI) yordamida chuqur tahlil qilinmoqda...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-lg text-slate-900">
                Testni yakunlashni xohlaysizmi?
              </h3>
            </div>

            <p className="text-sm text-slate-600">
              Siz <strong>{selectedQuestions.length}</strong> ta savoldan{' '}
              <strong>{answeredCount}</strong> tasiga javob berdingiz.
              {answeredCount < selectedQuestions.length && (
                <span className="text-red-600 block mt-1 font-medium">
                  Diqqat: {selectedQuestions.length - answeredCount} ta savolga hali javob berilmadi!
                </span>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Davom ettirish
              </button>
              <button
                onClick={() => handleSubmitQuiz('normal')}
                className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs"
              >
                Ha, yakunlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Switch 1st Warning Modal (1 / 2) */}
      {showTabWarningModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl border-2 border-amber-400">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                  Ogohlantirish (1 / 2)
                </span>
                <h3 className="font-extrabold text-lg sm:text-xl text-slate-900 mt-1">
                  Boshqa tabga yoki dasturga o'tdingiz!
                </h3>
              </div>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              Maktab bilim sinovi qoidalariga binoan, test topshirish jarayonida brauzerdagi boshqa tabga, yangi oynaga yoki boshqa dasturga o'tish qat'iyan taqiqlanadi!
            </p>

            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl">
              <p className="text-xs sm:text-sm font-bold text-red-800 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 shrink-0 text-red-600" />
                <span>
                  DIQQAT: Agar yana 1 marta boshqa oynaga/tabga o'tsangiz, testingiz DARHOL TO'XTATILADI va yakunlanadi!
                </span>
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowTabWarningModal(false);
                  enterFullscreen();
                }}
                className="w-full py-3 px-5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md active:scale-98"
              >
                Tushundim, testni davom ettirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
