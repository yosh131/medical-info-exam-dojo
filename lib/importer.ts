import { z } from "zod";
import { db, isoNow, makeId } from "./db";
import type { Choice, ImportQuestion, Question } from "./types";

const choiceSchema = z.object({
  label: z.string().trim().min(1), text: z.string().trim().min(1), isCorrect: z.boolean().optional()
}).strict();

export const importQuestionSchema = z.object({
  examYear: z.number().int().min(2000).max(2100),
  subject: z.enum(["information", "medical", "system"]),
  questionNo: z.number().int().min(1), body: z.string().trim().min(1),
  questionType: z.enum(["single_choice", "multiple_choice", "true_false_combination", "other"]),
  choices: z.array(choiceSchema).min(2),
  correctAnswer: z.union([z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)]),
  explanation: z.string().optional(), topicSummary: z.string().optional(), source: z.string().optional(),
  sourceUrl: z.string().url().optional(), rightsNote: z.string().optional()
}).strict().superRefine((question, ctx) => {
  const labels = question.choices.map((choice) => choice.label);
  if (new Set(labels).size !== labels.length) ctx.addIssue({ code: "custom", path: ["choices"], message: "選択肢ラベルが重複しています" });
  const answers = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
  for (const answer of answers) if (!labels.includes(answer)) ctx.addIssue({ code: "custom", path: ["correctAnswer"], message: `正解ラベル「${answer}」が選択肢にありません` });
  if (question.questionType === "single_choice" && Array.isArray(question.correctAnswer)) ctx.addIssue({ code: "custom", path: ["correctAnswer"], message: "単一選択の正解は文字列で指定してください" });
  if (question.questionType === "multiple_choice" && !Array.isArray(question.correctAnswer)) ctx.addIssue({ code: "custom", path: ["correctAnswer"], message: "複数選択の正解は配列で指定してください" });
});

const importArraySchema = z.array(importQuestionSchema);
export type PreviewStatus = "ready" | "duplicate" | "conflict" | "invalid";
export interface ImportPreviewRow {
  index: number; status: PreviewStatus; question?: ImportQuestion; contentHash?: string; message?: string;
}
export interface ImportPreview { rows: ImportPreviewRow[]; ready: number; duplicate: number; conflict: number; invalid: number }

export function parseImportJson(text: string): unknown {
  try { return JSON.parse(text); } catch { throw new Error("JSONの構文が正しくありません"); }
}

export async function contentHash(question: ImportQuestion) {
  const normalized = [question.body, ...question.choices.map((choice) => choice.text),
    ...(Array.isArray(question.correctAnswer) ? [...question.correctAnswer].sort() : [question.correctAnswer])].join("\u001f");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function previewImport(input: unknown): Promise<ImportPreview> {
  const arrayCheck = z.array(z.unknown()).safeParse(input);
  if (!arrayCheck.success) throw new Error("最上位は問題オブジェクトの配列である必要があります");
  const rows: ImportPreviewRow[] = [];
  const seenKeys = new Map<string, string>();
  const seenHashes = new Set<string>();
  const existing = await db.questions.toArray();
  const byKey = new Map(existing.map((q) => [`${q.examYear}|${q.subject}|${q.questionNo}`, q.contentHash]));
  const existingHashes = new Set(existing.map((q) => q.contentHash));

  for (const [index, raw] of arrayCheck.data.entries()) {
    const parsed = importQuestionSchema.safeParse(raw);
    if (!parsed.success) {
      rows.push({ index, status: "invalid", message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" / ") });
      continue;
    }
    const hash = await contentHash(parsed.data);
    const key = `${parsed.data.examYear}|${parsed.data.subject}|${parsed.data.questionNo}`;
    const oldHash = byKey.get(key) ?? seenKeys.get(key);
    if (oldHash && oldHash !== hash) rows.push({ index, status: "conflict", question: parsed.data, contentHash: hash, message: "同じ年度・科目・問番号に異なる内容があります" });
    else if (oldHash === hash || existingHashes.has(hash) || seenHashes.has(hash)) rows.push({ index, status: "duplicate", question: parsed.data, contentHash: hash, message: "同一内容をスキップします" });
    else {
      rows.push({ index, status: "ready", question: parsed.data, contentHash: hash });
      seenKeys.set(key, hash); seenHashes.add(hash);
    }
  }
  return { rows, ready: rows.filter((r) => r.status === "ready").length, duplicate: rows.filter((r) => r.status === "duplicate").length,
    conflict: rows.filter((r) => r.status === "conflict").length, invalid: rows.filter((r) => r.status === "invalid").length };
}

export async function commitImport(preview: ImportPreview) {
  const ready = preview.rows.filter((row) => row.status === "ready" && row.question && row.contentHash);
  await db.transaction("rw", db.questions, db.choices, async () => {
    for (const row of ready) {
      const input = row.question!; const id = makeId(); const now = isoNow();
      const question: Question = { id, examYear: input.examYear, subject: input.subject, questionNo: input.questionNo,
        body: input.body, questionType: input.questionType, correctAnswer: input.correctAnswer,
        explanation: input.explanation, topicSummary: input.topicSummary, source: input.source, sourceUrl: input.sourceUrl,
        rightsNote: input.rightsNote, contentHash: row.contentHash!, createdAt: now, updatedAt: now };
      const answers = new Set(Array.isArray(input.correctAnswer) ? input.correctAnswer : [input.correctAnswer]);
      const choices: Choice[] = input.choices.map((choice) => ({ id: makeId(), questionId: id, label: choice.label,
        text: choice.text, isCorrect: answers.has(choice.label) }));
      await db.questions.add(question); await db.choices.bulkAdd(choices);
    }
  });
  return ready.length;
}

export function isCorrectAnswer(userAnswer: string | string[], correctAnswer: string | string[]) {
  const user = (Array.isArray(userAnswer) ? userAnswer : [userAnswer]).slice().sort();
  const correct = (Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer]).slice().sort();
  return user.length === correct.length && user.every((answer, i) => answer === correct[i]);
}
