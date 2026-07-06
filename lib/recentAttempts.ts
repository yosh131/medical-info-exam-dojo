export function latestAttempts<T extends { attemptedAt: string }>(attempts: T[], limit = 20) {
  return attempts.slice().sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt)).slice(0, limit);
}

export function latestAttemptQuestionIds<T extends { attemptedAt: string; questionId: string }>(attempts: T[], limit = 20) {
  return new Set(latestAttempts(attempts, limit).map((attempt) => attempt.questionId));
}
