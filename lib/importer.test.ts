import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { strToU8, zipSync } from "fflate";
import { db } from "./db";
import { commitImport, importQuestionSchema, isCorrectAnswer, previewBundle } from "./importer";

const valid = { examYear:2025, subject:"system", questionNo:1, body:"架空問題", questionType:"single_choice", choices:[{label:"1",text:"選択肢1"},{label:"2",text:"選択肢2"}], correctAnswer:"2", media:[] };
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

function bundleFile(hash?:string,path="media/example.png"){
  const media=strToU8("fake png bytes");const actual=createHash("sha256").update(media).digest("hex");
  const question={...valid,media:[{id:"m1",role:"question",order:0,path,fileName:"example.png",mimeType:"image/png",sha256:hash??actual}]};
  const manifest={format:"medical-info-exam-question-bundle",schemaVersion:1,createdAt:"2026-06-21T00:00:00.000Z",questionsFile:"questions.json",questionCount:1,mediaCount:1};
  const zip=zipSync({"manifest.json":strToU8(JSON.stringify(manifest)),"questions.json":strToU8(JSON.stringify([question])),[path]:media});
  const buffer=zip.buffer.slice(zip.byteOffset,zip.byteOffset+zip.byteLength) as ArrayBuffer;
  return {size:zip.byteLength,arrayBuffer:async()=>buffer} as File;
}
describe("question bundles",()=>{
  it("validates and atomically stores a media bundle",async()=>{await db.delete();await db.open();const preview=await previewBundle(bundleFile());expect(preview).toMatchObject({ready:1,invalid:0,mediaCount:1});expect(await commitImport(preview)).toBe(1);expect(await db.questions.count()).toBe(1);const stored=await db.questionMedia.toArray();expect(stored).toHaveLength(1);expect(stored[0]).toMatchObject({mimeType:"image/png",role:"question"});expect(stored[0].blob).toBeDefined()});
  it("reports a media hash mismatch",async()=>{await db.delete();await db.open();const preview=await previewBundle(bundleFile("0".repeat(64)));expect(preview.invalid).toBe(1);expect(preview.rows[0].message).toContain("SHA-256")});
  it("rejects unsafe zip paths",async()=>{await expect(previewBundle(bundleFile(undefined,"../example.png"))).rejects.toThrow("安全でないZIPパス")});
});
