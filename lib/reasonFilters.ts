import type { ErrorAnalysis, ErrorReason, Question } from "./types";

export function isErrorReason(value: string | null): value is ErrorReason {
  return value === "A" || value === "B" || value === "C" || value === "D" || value === "E" || value === "F";
}

export function analysisHasReason(analysis: ErrorAnalysis, reason: ErrorReason) {
  return analysis.primaryReason === reason || analysis.secondaryReasons.includes(reason);
}

export function questionIdsForReason(analyses: ErrorAnalysis[], reason: ErrorReason) {
  return new Set(analyses.filter((analysis) => analysisHasReason(analysis, reason)).map((analysis) => analysis.questionId));
}

export function filterQuestionsByReason<T extends Pick<Question, "id">>(
  questions: T[],
  analyses: ErrorAnalysis[],
  reason?: ErrorReason
) {
  if (!reason) return questions;
  const ids = questionIdsForReason(analyses, reason);
  return questions.filter((question) => ids.has(question.id));
}

export function summarizeReasonUsage(analyses: ErrorAnalysis[]) {
  const reasons: ErrorReason[] = ["A", "B", "C", "D", "E", "F"];
  return reasons.map((reason) => ({
    reason,
    analyses: analyses.filter((analysis) => analysisHasReason(analysis, reason)).length,
    questions: questionIdsForReason(analyses, reason).size
  }));
}
