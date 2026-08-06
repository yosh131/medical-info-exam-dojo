import { describe, expect, it } from "vitest";
import { filterQuestionsByReason, isErrorReason, questionIdsForReason, summarizeReasonUsage } from "./reasonFilters";
import type { ErrorAnalysis, Question } from "./types";

const analyses = [
  { id: "a1", attemptId: "t1", questionId: "q1", primaryReason: "A", secondaryReasons: ["C"], createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "a2", attemptId: "t2", questionId: "q2", primaryReason: "B", secondaryReasons: [], createdAt: "2026-01-02T00:00:00.000Z" },
  { id: "a3", attemptId: "t3", questionId: "q1", primaryReason: "C", secondaryReasons: ["A"], createdAt: "2026-01-03T00:00:00.000Z" }
] as ErrorAnalysis[];

const questions = [{ id: "q1" }, { id: "q2" }, { id: "q3" }] as Question[];

describe("reason filters", () => {
  it("validates A-F reason query values", () => {
    expect(isErrorReason("A")).toBe(true);
    expect(isErrorReason("F")).toBe(true);
    expect(isErrorReason("G")).toBe(false);
    expect(isErrorReason(null)).toBe(false);
  });

  it("collects unique question ids for primary and secondary reasons", () => {
    expect([...questionIdsForReason(analyses, "A")]).toEqual(["q1"]);
    expect([...questionIdsForReason(analyses, "B")]).toEqual(["q2"]);
  });

  it("filters questions by a reason", () => {
    expect(filterQuestionsByReason(questions, analyses, "C").map((question) => question.id)).toEqual(["q1"]);
    expect(filterQuestionsByReason(questions, analyses).map((question) => question.id)).toEqual(["q1", "q2", "q3"]);
  });

  it("summarizes analysis and unique question counts", () => {
    expect(summarizeReasonUsage(analyses).find((row) => row.reason === "A")).toEqual({ reason: "A", analyses: 2, questions: 1 });
  });
});
