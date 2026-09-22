export type QuestionType = 'multiple-choice' | 'written';

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  // Multiple-choice fields
  options?: string[]; // 4 options (A, B, C, D)
  correctOptionIndex?: number; // 0, 1, 2, or 3
  // Written fields
  expectedAnswer?: string;
  keywords?: string[];
  explanation?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  grade: string;
  coverColor: string;
  description: string;
  questions: Question[];
  createdAt: string;
}

export interface TestDeliveryConfig {
  totalQuestions: number; // e.g. 20
  multipleChoiceCount: number; // e.g. 15
  writtenCount: number; // e.g. 5
  timeLimitMinutes: number; // e.g. 25
  // Kengaytirilgan sozlamalar
  shuffleQuestions?: boolean; // Savollarni random aralashtirish
  passingScorePercent?: number; // O'tish bali (%)
  grade5Threshold?: number; // A'lo baho chegarasi (%) masalan 86%
  grade4Threshold?: number; // Yaxshi baho chegarasi (%) masalan 71%
  grade3Threshold?: number; // Qoniqarli baho chegarasi (%) masalan 56%
  aiEvaluationStrictness?: 'lenient' | 'moderate' | 'strict'; // AI baholash qat'iyligi
  showExplanationsAfterTest?: boolean; // Testdan so'ng to'g'ri javoblar va izohlarni ko'rsatish
  enableConfetti?: boolean; // Muvaffaqiyat animatsiyasi
}

export interface AIGenerationConfig {
  totalGenerateCount: number; // e.g. 80
  multipleChoiceGenerateCount: number; // e.g. 60
  writtenGenerateCount: number; // e.g. 20
}

export interface StudentInfo {
  fullName: string;
  grade: string;
}

export interface QuestionResultDetail {
  questionId: string;
  questionText: string;
  type: QuestionType;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation?: string;
  aiFeedback?: string;
}

export interface StudentTestResult {
  id: string;
  studentName: string;
  studentGrade: string;
  bookId: string;
  bookTitle: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  multipleChoiceCorrect: number;
  multipleChoiceTotal: number;
  writtenCorrect: number;
  writtenTotal: number;
  durationSeconds: number;
  completedAt: string;
  gradeBadge: '5 (A\'lo)' | '4 (Yaxshi)' | '3 (Qoniqarli)' | '2 (Qoniqarsiz)';
  terminatedReason?: 'normal' | 'timeout' | 'tab_switch';
  details: QuestionResultDetail[];
}
