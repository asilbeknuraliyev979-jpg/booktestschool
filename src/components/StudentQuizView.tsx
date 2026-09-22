import React, { useState, useEffect, useMemo } from 'react';
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

  // Timer countdown
  useEffect(() => {
    if (isSubmitted) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitQuiz();
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
  const handleSubmitQuiz = async () => {
    setShowConfirmModal(false);
    setIsEvaluatingWithAI(true);

    const writtenQuestions = selectedQuestions.filter((q) => q.type === 'written');
    let aiEvaluationMap: Record<string, { isAccepted: boolean; feedback: string }> = {};

    if (writtenQuestions.length > 0) {
      try {
        const payloadEvaluations = writtenQuestions.map((q) => ({
          questionId: q.id,
          question: q.question,
          expectedAnswer: q.expectedAnswer || '',
          studentAnswer: writtenAnswers[q.id] || '',
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
        const studentChoiceIndex = mcAnswers[q.id];
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
        const studentText = writtenAnswers[q.id] || '';
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

    const testDuration = deliveryConfig.timeLimitMinutes * 60 - timeLeft;

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
      gradeBadge,
      details,
    };

    setIsEvaluatingWithAI(false);
    setResult(testResult);
    setIsSubmitted(true);
    onComplete(testResult);

    if (percentage >= 70) {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  };

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
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
        {/* Result Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6 sm:p-8 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-xs rounded-full text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Test yakunlandi</span>
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
              Natija admin hisobotiga saqlandi
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
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <h3 className="text-lg font-bold text-slate-900 border-b pb-3">
            Savollar tahlili va to'g'ri javoblar
          </h3>

          <div className="space-y-4">
            {result.details.map((item, idx) => (
              <div
                key={item.questionId}
                className={`p-4 rounded-xl border transition-all ${
                  item.isCorrect
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : 'bg-red-50/50 border-red-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-slate-200 text-slate-700">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {item.type === 'multiple-choice' ? 'Variantli' : 'Yozma'}
                    </span>
                  </div>
                  {item.isCorrect ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      To'g'ri
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold text-red-700">
                      <XCircle className="w-4 h-4 text-red-600" />
                      Noto'g'ri
                    </span>
                  )}
                </div>

                <p className="font-semibold text-slate-900 text-sm sm:text-base mt-2">
                  {item.questionText}
                </p>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-white/80 border border-slate-200">
                    <span className="text-slate-500 block mb-0.5">Sizning javobingiz:</span>
                    <span className={`font-semibold ${item.isCorrect ? 'text-emerald-800' : 'text-red-800'}`}>
                      {item.studentAnswer}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/80 border border-slate-200">
                    <span className="text-slate-500 block mb-0.5">To'g'ri javob:</span>
                    <span className="font-semibold text-slate-900">
                      {item.correctAnswer}
                    </span>
                  </div>
                </div>

                {item.aiFeedback && (
                  <div className="mt-2.5 text-xs flex items-start gap-2 bg-blue-50/90 border border-blue-200/80 p-3 rounded-xl text-blue-950">
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-blue-900 block mb-0.5">AI O'qituvchi Tahlili:</span>
                      <p className="text-slate-700 leading-relaxed">{item.aiFeedback}</p>
                    </div>
                  </div>
                )}

                {item.explanation && (
                  <p className="mt-2 text-xs text-slate-500 bg-white/60 p-2 rounded-md">
                    <strong>Izoh:</strong> {item.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="pt-4 text-center">
            <button
              onClick={onCancel}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-sm transition-all"
            >
              Bosh sahifaga qaytish
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE TEST TAKING VIEW
  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-16">
      {/* Top Test Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
            {studentInfo.grade}
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
            "{book.title}" bo'yicha test
          </h2>
          <p className="text-xs text-slate-500">
            O'quvchi: <strong>{studentInfo.fullName}</strong>
          </p>
        </div>

        {/* Timer and Status */}
        <div className="flex items-center gap-4">
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
            <label className="block text-xs font-semibold text-slate-700">
              Javobingizni quyidagi maydonga yozing:
            </label>

            <div className="relative">
              <textarea
                rows={4}
                value={writtenAnswers[currentQ.id] || ''}
                onChange={(e) =>
                  setWrittenAnswers({
                    ...writtenAnswers,
                    [currentQ.id]: e.target.value,
                  })
                }
                placeholder="Savolga javobingizni qisqa va aniq yozing (o'z so'zlaringiz bilan bayon qilishingiz mumkin)..."
                className="w-full p-4 rounded-xl border border-slate-300 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 text-sm font-medium leading-relaxed resize-y"
              />
            </div>

            <p className="text-xs text-slate-500">
              Eslatma: Qahramonlar ismi, voqealar va sabab-oqibatlarni o'z so'zlaringiz bilan yozishingiz mumkin. Test yakunida barcha javoblar AI tomonidan tekshiriladi.
            </p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Oldingisi</span>
          </button>

          {currentIndex < selectedQuestions.length - 1 ? (
            <button
              onClick={() => setCurrentIndex((prev) => prev + 1)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs"
            >
              <span>Keyingisi</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setShowConfirmModal(true)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs"
            >
              <Send className="w-4 h-4" />
              <span>Testni yakunlash</span>
            </button>
          )}
        </div>
      </div>

      {/* Cancel/Exit button */}
      <div className="text-center">
        <button
          onClick={onCancel}
          className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          Testni to'xtatish va chiqish
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900">
                Testni yakunlaysizmi?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Jami {selectedQuestions.length} ta savoldan{' '}
                <strong>{answeredCount}</strong> tasiga javob berdingiz.
                {answeredCount < selectedQuestions.length && (
                  <span className="block text-amber-600 font-semibold mt-1">
                    Diqqat: {selectedQuestions.length - answeredCount} ta savol javobsiz qolgan!
                  </span>
                )}
              </p>
              <div className="mt-3 p-2.5 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-center gap-2 text-left">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Yozma javoblaringiz AI o'qituvchi tomonidan chuqur tahlil qilinib baholanadi.</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Davom etish
              </button>
              <button
                onClick={handleSubmitQuiz}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs sm:text-sm font-semibold text-white shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>Ha, yakunlash</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Evaluation in progress modal */}
      {isEvaluatingWithAI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4 border border-slate-100">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-md">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                AI javoblarni tahlil qilmoqda...
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                O'quvchining yozma javoblari etalonga yaqinligi va asar mazmuniga mosligi sun'iy intellekt tomonidan tekshirilmoqda.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs font-semibold text-blue-700">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Gemini AI adolatli baholash</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
