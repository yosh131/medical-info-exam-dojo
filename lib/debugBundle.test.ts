import { describe, expect, it } from "vitest";
import { referencedMediaPaths, selectDebugQuestions } from "./debugBundle";

describe("debug bundle selection", () => {
  it("prioritizes media questions and respects the limit", () => {
    const rows = [{ id: 1 }, { id: 2, media: [{ path: "media/a.png" }] }, { id: 3 }, { id: 4, media: [{ path: "media/b.png" }] }];
    expect(selectDebugQuestions(rows, 3).map((row) => row.id)).toEqual([2, 4, 1]);
  });

  it("returns unique referenced media paths", () => {
    expect(referencedMediaPaths([{ media: [{ path: "a" }, { path: "a" }] }, { media: [{ path: "b" }] }])).toEqual(["a", "b"]);
  });
});
