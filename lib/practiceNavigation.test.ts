import { describe, expect, it } from "vitest";
import { adjacentQuestion, sortPracticeQuestions } from "./practiceNavigation";

const questions = [
  { id: "med-1", examYear: 2025, subject: "medical" as const, questionNo: 1 },
  { id: "it-2", examYear: 2025, subject: "information" as const, questionNo: 2 },
  { id: "old", examYear: 2024, subject: "information" as const, questionNo: 1 },
  { id: "sys-1", examYear: 2025, subject: "system" as const, questionNo: 1 },
  { id: "it-1", examYear: 2025, subject: "information" as const, questionNo: 1 }
];

describe("practice navigation", () => {
  it("orders by newest year, subject, then question number", () => {
    expect(sortPracticeQuestions(questions).map((question) => question.id)).toEqual([
      "it-1", "it-2", "sys-1", "med-1", "old"
    ]);
  });

  it("does not wrap at either end", () => {
    const sorted = sortPracticeQuestions(questions);
    expect(adjacentQuestion(sorted, "it-1", -1)).toBeUndefined();
    expect(adjacentQuestion(sorted, "it-1", 1)?.id).toBe("it-2");
    expect(adjacentQuestion(sorted, "old", 1)).toBeUndefined();
  });
});
