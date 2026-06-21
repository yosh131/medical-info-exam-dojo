export type Subject = "information" | "medical" | "system";
export type QuestionType = "single_choice" | "multiple_choice" | "true_false_combination" | "other";
export type Confidence = "high" | "medium" | "low";
export type ErrorReason = "A" | "B" | "C" | "D" | "E" | "F";
export type ReadingMistakeType =
  | "missed_negative" | "missed_positive" | "missed_best_answer"
  | "wrong_subject" | "missed_condition" | "missed_number_or_unit" | "other";
export type CardType = "term" | "judgement" | "comparison" | "workflow" | "calculation" | "reading_mistake";
export type ReviewResult = "good" | "hard" | "again";
export type ReviewTargetType = "question" | "card";

export interface Question {
  id: string; examYear: number; subject: Subject; questionNo: number; body: string;
  questionType: QuestionType; correctAnswer: string | string[]; explanation?: string;
  topicSummary?: string; source?: string; sourceUrl?: string; rightsNote?: string;
  contentHash: string; createdAt: string; updatedAt: string;
}
export interface Choice { id: string; questionId: string; label: string; text: string; isCorrect?: boolean }
export interface Attempt {
  id: string; questionId: string; userAnswer: string | string[]; isCorrect: boolean;
  confidence: Confidence; elapsedSec?: number; attemptedAt: string;
}
export interface ErrorAnalysis {
  id: string; attemptId: string; questionId: string; primaryReason: ErrorReason;
  secondaryReasons: ErrorReason[]; readingMistakeType?: ReadingMistakeType; note?: string; createdAt: string;
}
export interface Card {
  id: string; questionId?: string; subject: Subject; cardType: CardType; front: string; back: string;
  tags: string[]; dueAt: string; intervalDays: number; reviewCount: number; successCount: number;
  failureCount: number; isImportant: boolean; sourceReason?: ErrorReason; examWeekReviewedAt?: string; createdAt: string; updatedAt: string;
}
export interface ReviewSchedule {
  id: string; targetType: ReviewTargetType; targetId: string; dueAt: string;
  successStreak: number; intervalDays: number; updatedAt: string;
}
export interface ReviewLog {
  id: string; targetType: ReviewTargetType; targetId: string; result: ReviewResult; reviewedAt: string;
}
export interface AppSetting { key: string; value: unknown; updatedAt: string }
export interface AppSettings { examDate?: string; lastBackupAt?: string; storagePersisted?: boolean }

export interface ImportChoice { label: string; text: string; isCorrect?: boolean }
export interface ImportQuestion {
  examYear: number; subject: Subject; questionNo: number; body: string; questionType: QuestionType;
  choices: ImportChoice[]; correctAnswer: string | string[]; explanation?: string; topicSummary?: string;
  source?: string; sourceUrl?: string; rightsNote?: string;
}
export interface BackupEnvelope {
  schemaVersion: 1; exportedAt: string; app: "medical-info-exam-dojo";
  data: { questions: Question[]; choices: Choice[]; attempts: Attempt[]; errorAnalyses: ErrorAnalysis[];
    cards: Card[]; reviewSchedules: ReviewSchedule[]; reviewLogs: ReviewLog[]; settings: AppSetting[] };
}

export const SUBJECT_LABELS: Record<Subject, string> = {
  information: "情報処理技術系", medical: "医学・医療系", system: "医療情報システム系"
};
export const CONFIDENCE_LABELS: Record<Confidence, string> = { high: "自信あり", medium: "迷った", low: "ほぼ勘" };
export const ERROR_LABELS: Record<ErrorReason, string> = {
  A: "用語を知らない", B: "制度・法令を知らない", C: "医療業務フローが曖昧",
  D: "標準規格・システム構成が曖昧", E: "計算・統計・DB・NWの穴", F: "問題文の読み落とし"
};
export const CARD_TYPE_LABELS: Record<CardType, string> = {
  term: "用語", judgement: "判断", comparison: "比較", workflow: "業務フロー",
  calculation: "計算手順", reading_mistake: "読み落とし注意"
};
