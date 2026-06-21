import { describe, expect, it } from "vitest";
import { importQuestionSchema, isCorrectAnswer } from "./importer";

const valid = { examYear:2025, subject:"system", questionNo:1, body:"架空問題", questionType:"single_choice", choices:[{label:"1",text:"選択肢1"},{label:"2",text:"選択肢2"}], correctAnswer:"2" };
describe("question import validation",()=>{
  it("accepts a valid question",()=>expect(importQuestionSchema.safeParse(valid).success).toBe(true));
  it("rejects duplicate labels",()=>expect(importQuestionSchema.safeParse({...valid,choices:[{label:"1",text:"a"},{label:"1",text:"b"}]}).success).toBe(false));
  it("rejects a missing answer label",()=>expect(importQuestionSchema.safeParse({...valid,correctAnswer:"9"}).success).toBe(false));
  it("rejects unknown fields",()=>expect(importQuestionSchema.safeParse({...valid,secret:"x"}).success).toBe(false));
  it("requires arrays for multiple choice",()=>expect(importQuestionSchema.safeParse({...valid,questionType:"multiple_choice"}).success).toBe(false));
});
describe("grading",()=>{
  it("ignores multi-answer ordering",()=>expect(isCorrectAnswer(["3","1"],["1","3"])).toBe(true));
  it("requires an exact answer set",()=>expect(isCorrectAnswer(["1"],["1","3"])).toBe(false));
});
