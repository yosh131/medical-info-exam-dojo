import type { Question, Subject } from "./types";

const subjectOrder: Record<Subject, number> = {
  information: 0,
  system: 1,
  medical: 2
};

export function sortPracticeQuestions<T extends Pick<Question, "examYear" | "subject" | "questionNo">>(questions: T[]) {
  return questions.slice().sort((a, b) =>
    b.examYear - a.examYear ||
    subjectOrder[a.subject] - subjectOrder[b.subject] ||
    a.questionNo - b.questionNo
  );
}

export function adjacentQuestion<T extends { id: string }>(questions: T[], currentId: string, direction: -1 | 1) {
  const index = questions.findIndex((question) => question.id === currentId);
  if (index < 0) return undefined;
  return questions[index + direction];
}
