import { describe, expect, it } from "vitest";
import { isUnknownAnswer, toggleAnswerSelection, UNKNOWN_ANSWER } from "./answerSelection";

describe("answer selection", () => {
  it("allows a single choice to be changed or cleared before grading", () => {
    expect(toggleAnswerSelection([], "1", false)).toEqual(["1"]);
    expect(toggleAnswerSelection(["1"], "2", false)).toEqual(["2"]);
    expect(toggleAnswerSelection(["2"], "2", false)).toEqual([]);
  });

  it("toggles multiple choices independently", () => {
    expect(toggleAnswerSelection(["1"], "3", true)).toEqual(["1", "3"]);
    expect(toggleAnswerSelection(["1", "3"], "1", true)).toEqual(["3"]);
  });

  it("recognizes the explicit unknown answer", () => {
    expect(isUnknownAnswer(UNKNOWN_ANSWER)).toBe(true);
    expect(isUnknownAnswer("1")).toBe(false);
  });
});
