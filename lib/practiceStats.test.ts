import { describe, expect, it } from "vitest";
import { filterQuestionsByPracticeMode, progressStatus, summarizeProgress, summarizeProgressByCategory } from "./practiceStats";
import type { Attempt, Card, Question } from "./types";

const questions = [
  { id: "new", examYear: 2026, subject: "information" },
  { id: "wrong", examYear: 2026, subject: "information" },
  { id: "fixed", examYear: 2026, subject: "system" },
  { id: "flagged", examYear: 2025, subject: "medical" }
] as Question[];

const attempts = [
  { id: "a1", questionId: "wrong", isCorrect: false, userAnswer: "1", confidence: "high", attemptedAt: "2026-01-01T00:00:00.000Z" },
  { id: "a2", questionId: "fixed", isCorrect: false, userAnswer: "1", confidence: "high", attemptedAt: "2026-01-01T00:00:00.000Z" },
  { id: "a3", questionId: "fixed", isCorrect: true, userAnswer: "2", confidence: "high", attemptedAt: "2026-01-02T00:00:00.000Z" }
] as Attempt[];

const cards = [
  { id: "c1", questionId: "flagged", isImportant: true },
  { id: "c2", questionId: "wrong", isImportant: false }
] as Card[];

describe("practice stats", () => {
  it("uses the latest attempt as the progress status", () => {
    expect(progressStatus("new", attempts)).toBe("unanswered");
    expect(progressStatus("wrong", attempts)).toBe("wrong");
    expect(progressStatus("fixed", attempts)).toBe("correct");
  });

  it("filters questions by compact practice modes", () => {
    expect(filterQuestionsByPracticeMode(questions, attempts, cards, "unanswered").map((q) => q.id)).toEqual(["new", "flagged"]);
    expect(filterQuestionsByPracticeMode(questions, attempts, cards, "wrong").map((q) => q.id)).toEqual(["wrong"]);
    expect(filterQuestionsByPracticeMode(questions, attempts, cards, "flagged").map((q) => q.id)).toEqual(["flagged"]);
  });

  it("summarizes unanswered, wrong, and correct ratios", () => {
    expect(summarizeProgress(questions, attempts)).toEqual({ total: 4, unanswered: 2, wrong: 1, correct: 1 });
    expect(summarizeProgressByCategory(questions, attempts).find((row) => row.examYear === 2026 && row.subject === "information")).toMatchObject({
      total: 2,
      unanswered: 1,
      wrong: 1,
      correct: 0
    });
  });
});
