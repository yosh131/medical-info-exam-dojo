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

export function filterPracticeQuestions<T extends Pick<Question, "examYear" | "subject">>(
  questions: T[],
  years: ReadonlySet<number>,
  subjects: ReadonlySet<Subject>
) {
  return questions.filter((question) => years.has(question.examYear) && subjects.has(question.subject));
}

function seedNumber(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function shufflePracticeQuestions<T>(questions: T[], seed: string) {
  const shuffled = questions.slice();
  let state = seedNumber(seed) || 1;
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}
