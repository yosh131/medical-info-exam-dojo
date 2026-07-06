type DebugQuestion = { media?: Array<{ path: string }> };

export function selectDebugQuestions<T extends DebugQuestion>(questions: T[], count: number) {
  if (!Number.isInteger(count) || count < 1) throw new Error("count must be a positive integer");
  const selected: T[] = [];
  const add = (question: T) => { if (!selected.includes(question) && selected.length < count) selected.push(question); };

  questions.filter((question) => question.media?.length).slice(0, 2).forEach(add);
  questions.forEach(add);
  return selected;
}

export function referencedMediaPaths(questions: DebugQuestion[]) {
  return [...new Set(questions.flatMap((question) => (question.media ?? []).map((media) => media.path)))];
}
