import { describe, expect, it } from "vitest";
import { latestAttemptQuestionIds, latestAttempts } from "./recentAttempts";

const attempts = [
  { questionId: "old", attemptedAt: "2026-01-01T00:00:00Z", isCorrect: false },
  { questionId: "new", attemptedAt: "2026-01-03T00:00:00Z", isCorrect: true },
  { questionId: "middle", attemptedAt: "2026-01-02T00:00:00Z", isCorrect: true },
  { questionId: "new", attemptedAt: "2026-01-04T00:00:00Z", isCorrect: false }
];

describe("recent attempts", () => {
  it("returns the newest attempts in order", () => {
    expect(latestAttempts(attempts, 2).map((attempt) => attempt.attemptedAt)).toEqual([
      "2026-01-04T00:00:00Z", "2026-01-03T00:00:00Z"
    ]);
  });

  it("returns unique question ids represented by the recent attempts", () => {
    expect([...latestAttemptQuestionIds(attempts, 3)]).toEqual(["new", "middle"]);
  });
});
