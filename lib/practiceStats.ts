import type { Attempt, Card, ErrorAnalysis, Question, Subject } from "./types";

export type PracticeMode = "all" | "unanswered" | "wrong" | "flagged";
export type ProgressStatus = "unanswered" | "wrong" | "correct";

export interface ProgressSummary {
  total: number;
  unanswered: number;
  wrong: number;
  correct: number;
}

export interface CategoryProgress extends ProgressSummary {
  examYear: number;
  subject: Subject;
}

const subjectRank: Record<Subject, number> = { information: 0, system: 1, medical: 2 };

export function latestAttemptForQuestion(attempts: Attempt[], questionId: string) {
  return attempts
    .filter((attempt) => attempt.questionId === questionId)
    .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))[0];
}

export function progressStatus(questionId: string, attempts: Attempt[]): ProgressStatus {
  const latest = latestAttemptForQuestion(attempts, questionId);
  if (!latest) return "unanswered";
  return latest.isCorrect ? "correct" : "wrong";
}

export function flaggedQuestionIds(cards: Card[], analyses: ErrorAnalysis[] = []) {
  const ids = new Set(cards.filter((card) => card.isImportant && card.questionId).map((card) => card.questionId as string));
  for (const analysis of analyses) ids.add(analysis.questionId);
  return ids;
}

export function filterQuestionsByPracticeMode<T extends Pick<Question, "id">>(
  questions: T[],
  attempts: Attempt[],
  cards: Card[],
  analyses: ErrorAnalysis[],
  mode: PracticeMode
) {
  if (mode === "all") return questions;
  const flagged = mode === "flagged" ? flaggedQuestionIds(cards, analyses) : undefined;
  return questions.filter((question) => {
    if (mode === "flagged") return flagged?.has(question.id) ?? false;
    const status = progressStatus(question.id, attempts);
    if (mode === "unanswered") return status === "unanswered";
    return status === "wrong";
  });
}

export function summarizeProgress<T extends Pick<Question, "id">>(questions: T[], attempts: Attempt[]): ProgressSummary {
  const summary: ProgressSummary = { total: questions.length, unanswered: 0, wrong: 0, correct: 0 };
  for (const question of questions) summary[progressStatus(question.id, attempts)] += 1;
  return summary;
}

export function summarizeProgressByCategory<T extends Pick<Question, "id" | "examYear" | "subject">>(
  questions: T[],
  attempts: Attempt[]
) {
  const categories = new Map<string, CategoryProgress>();
  for (const question of questions) {
    const key = `${question.examYear}:${question.subject}`;
    const current = categories.get(key) ?? {
      examYear: question.examYear,
      subject: question.subject,
      total: 0,
      unanswered: 0,
      wrong: 0,
      correct: 0
    };
    current.total += 1;
    current[progressStatus(question.id, attempts)] += 1;
    categories.set(key, current);
  }
  return [...categories.values()].sort((a, b) => b.examYear - a.examYear || subjectRank[a.subject] - subjectRank[b.subject]);
}
