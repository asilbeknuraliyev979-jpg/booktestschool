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
  isActive?: boolean; // true = faol (Start), false = nofaol (Finish)
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

export const SCHOOL_GRADES = ['5', '6', '7', '8', '9', '10', '11'] as const;
export const CLASS_LETTERS = ['A', 'B', 'D'] as const;

export const ALL_SCHOOL_CLASSES = [
  '5-A', '5-B', '5-D',
  '6-A', '6-B', '6-D',
  '7-A', '7-B', '7-D',
  '8-A', '8-B', '8-D',
  '9-A', '9-B', '9-D',
  '10-A', '10-B', '10-D',
  '11-A', '11-B', '11-D',
] as const;

export type SchoolClass = typeof ALL_SCHOOL_CLASSES[number];

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
  submittedAt?: number;
  gradeBadge: '5 (A\'lo)' | '4 (Yaxshi)' | '3 (Qoniqarli)' | '2 (Qoniqarsiz)';
  terminatedReason?: 'normal' | 'timeout' | 'tab_switch';
  details: QuestionResultDetail[];
}
