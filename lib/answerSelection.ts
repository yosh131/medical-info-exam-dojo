export const UNKNOWN_ANSWER = "__unknown__";

export function isUnknownAnswer(answer: string | string[]) {
  return answer === UNKNOWN_ANSWER || (Array.isArray(answer) && answer.includes(UNKNOWN_ANSWER));
}

export function toggleAnswerSelection(current: string[], label: string, multiple: boolean) {
  if (!multiple) return current.includes(label) ? [] : [label];
  return current.includes(label) ? current.filter((value) => value !== label) : [...current, label];
}
