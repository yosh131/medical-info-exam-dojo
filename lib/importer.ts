import { strFromU8, unzipSync } from "fflate";
import { z } from "zod";
import { db, isoNow, makeId } from "./db";
import type { Choice, ImportQuestion, Question, QuestionBundleManifest, QuestionMedia } from "./types";

const MAX_BUNDLE_BYTES = 300 * 1024 * 1024;
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const mediaMimeSchema = z.enum(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);
const choiceSchema = z.object({
  label: z.string().trim().min(1), text: z.string().trim().min(1), isCorrect: z.boolean().optional()
}).strict();
const mediaSchema = z.object({
  id: z.string().min(1), role: z.enum(["question", "explanation"]), order: z.number().int().min(0),
  path: z.string().min(1), fileName: z.string().min(1), mimeType: mediaMimeSchema,
  sha256: z.string().regex(/^[a-f0-9]{64}$/i)
}).strict();

export const importQuestionSchema = z.object({
  examYear: z.number().int().min(2000).max(2100), subject: z.enum(["information", "medical", "system"]),
  questionNo: z.number().int().min(1), body: z.string().trim().min(1),
  questionType: z.enum(["single_choice", "multiple_choice", "true_false_combination", "other"]),
  choices: z.array(choiceSchema).min(2),
  correctAnswer: z.union([z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)]),
  explanation: z.string().optional(), bodyTableHtml: z.string().optional(), explanationTableHtml: z.string().optional(),
  topicSummary: z.string().optional(), media: z.array(mediaSchema), source: z.string().optional(),
  sourceUrl: z.string().url().optional(), rightsNote: z.string().optional()
}).strict().superRefine((question, ctx) => {
  const labels = question.choices.map((choice) => choice.label);
  if (new Set(labels).size !== labels.length) ctx.addIssue({ code: "custom", path: ["choices"], message: "選択肢ラベルが重複しています" });
  const answers = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
  for (const answer of answers) if (!labels.includes(answer)) ctx.addIssue({ code: "custom", path: ["correctAnswer"], message: `正解ラベル「${answer}」が選択肢にありません` });
  if (question.questionType === "single_choice" && Array.isArray(question.correctAnswer)) ctx.addIssue({ code: "custom", path: ["correctAnswer"], message: "単一選択の正解は文字列で指定してください" });
  if (question.questionType === "multiple_choice" && !Array.isArray(question.correctAnswer)) ctx.addIssue({ code: "custom", path: ["correctAnswer"], message: "複数選択の正解は配列で指定してください" });
  const mediaIds = question.media.map((item) => item.id);
  if (new Set(mediaIds).size !== mediaIds.length) ctx.addIssue({ code: "custom", path: ["media"], message: "メディアIDが重複しています" });
});

export const bundleManifestSchema = z.object({
  format: z.literal("medical-info-exam-question-bundle"), schemaVersion: z.literal(1),
  createdAt: z.string().datetime(), questionsFile: z.literal("questions.json"),
  questionCount: z.number().int().min(0), mediaCount: z.number().int().min(0)
}).strict();

export type PreviewStatus = "ready" | "duplicate" | "conflict" | "invalid";
export interface ImportPreviewRow {
  index: number; status: PreviewStatus; question?: ImportQuestion; contentHash?: string; message?: string;
}
export interface ImportPreview {
  manifest: QuestionBundleManifest; rows: ImportPreviewRow[]; files: Record<string, Uint8Array>;
  ready: number; duplicate: number; conflict: number; invalid: number; mediaCount: number;
}

function safeBundlePath(path: string) {
  return !path.startsWith("/") && !path.includes("\\") && !path.split("/").includes("..") && !path.includes("\0");
}

async function sha256(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength); copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function contentHash(question: ImportQuestion) {
  const normalized = [question.body, question.bodyTableHtml ?? "", question.explanationTableHtml ?? "",
    ...question.choices.map((choice) => choice.text),
    ...(Array.isArray(question.correctAnswer) ? [...question.correctAnswer].sort() : [question.correctAnswer]),
    ...question.media.map((item) => item.sha256).sort()].join("\u001f");
  return sha256(new TextEncoder().encode(normalized));
}

export async function previewBundle(file: File): Promise<ImportPreview> {
  if (file.size > MAX_BUNDLE_BYTES) throw new Error("ZIPは300MB以下にしてください");
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(new Uint8Array(await file.arrayBuffer())); }
  catch { throw new Error("ZIPを展開できませんでした"); }
  for (const path of Object.keys(files)) if (!safeBundlePath(path)) throw new Error(`安全でないZIPパスです: ${path}`);
  if (!files["manifest.json"] || !files["questions.json"]) throw new Error("manifest.jsonまたはquestions.jsonがありません");

  let manifestRaw: unknown, questionsRaw: unknown;
  try { manifestRaw = JSON.parse(strFromU8(files["manifest.json"])); questionsRaw = JSON.parse(strFromU8(files["questions.json"])); }
  catch { throw new Error("ZIP内JSONの構文が正しくありません"); }
  const manifestResult = bundleManifestSchema.safeParse(manifestRaw);
  if (!manifestResult.success) throw new Error("manifest.jsonの形式が正しくありません");
  const manifest = manifestResult.data;
  if (!Array.isArray(questionsRaw) || manifest.questionCount !== questionsRaw.length) throw new Error("manifestの問題件数とquestions.jsonが一致しません");

  const rows: ImportPreviewRow[] = [];
  const seenKeys = new Map<string, string>(); const seenHashes = new Set<string>(); const seenMediaIds = new Set<string>();
  const existing = await db.questions.toArray();
  const byKey = new Map(existing.map((q) => [`${q.examYear}|${q.subject}|${q.questionNo}`, q.contentHash]));
  const existingHashes = new Set(existing.map((q) => q.contentHash));
  let mediaCount = 0;

  for (const [index, raw] of questionsRaw.entries()) {
    const parsed = importQuestionSchema.safeParse(raw);
    if (!parsed.success) {
      rows.push({ index, status: "invalid", message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" / ") });
      continue;
    }
    let mediaError = "";
    for (const media of parsed.data.media) {
      mediaCount++;
      const bytes = files[media.path];
      let itemError = "";
      if (!safeBundlePath(media.path) || !media.path.startsWith("media/")) itemError = "メディアパスが不正です";
      else if (!bytes) itemError = `メディアがありません: ${media.path}`;
      else if (bytes.byteLength > MAX_MEDIA_BYTES) itemError = `メディアが25MBを超えています: ${media.path}`;
      else if (seenMediaIds.has(media.id)) itemError = `メディアIDがバンドル内で重複しています: ${media.id}`;
      else if (await sha256(bytes) !== media.sha256.toLowerCase()) itemError = `メディアのSHA-256が一致しません: ${media.path}`;
      seenMediaIds.add(media.id);
      if (!mediaError && itemError) mediaError = itemError;
    }
    if (mediaError) { rows.push({ index, status: "invalid", question: parsed.data, message: mediaError }); continue; }
    const hash = await contentHash(parsed.data); const key = `${parsed.data.examYear}|${parsed.data.subject}|${parsed.data.questionNo}`;
    const oldHash = byKey.get(key) ?? seenKeys.get(key);
    if (oldHash && oldHash !== hash) rows.push({ index, status: "conflict", question: parsed.data, contentHash: hash, message: "同じ年度・科目・問番号に異なる内容があります" });
    else if (oldHash === hash || existingHashes.has(hash) || seenHashes.has(hash)) rows.push({ index, status: "duplicate", question: parsed.data, contentHash: hash, message: "同一内容をスキップします" });
    else { rows.push({ index, status: "ready", question: parsed.data, contentHash: hash }); seenKeys.set(key, hash); seenHashes.add(hash); }
  }
  if (mediaCount !== manifest.mediaCount) throw new Error(`manifestのメディア件数（${manifest.mediaCount}）と実データ（${mediaCount}）が一致しません`);
  return { manifest, rows, files, mediaCount, ready: rows.filter((r) => r.status === "ready").length,
    duplicate: rows.filter((r) => r.status === "duplicate").length, conflict: rows.filter((r) => r.status === "conflict").length,
    invalid: rows.filter((r) => r.status === "invalid").length };
}

export async function commitImport(preview: ImportPreview) {
  const ready = preview.rows.filter((row) => row.status === "ready" && row.question && row.contentHash);
  await db.transaction("rw", db.questions, db.choices, db.questionMedia, async () => {
    for (const row of ready) {
      const input = row.question!; const id = makeId(); const now = isoNow();
      const question: Question = { id, examYear: input.examYear, subject: input.subject, questionNo: input.questionNo,
        body: input.body, bodyTableHtml: input.bodyTableHtml, explanationTableHtml: input.explanationTableHtml,
        questionType: input.questionType, correctAnswer: input.correctAnswer, explanation: input.explanation,
        topicSummary: input.topicSummary, source: input.source, sourceUrl: input.sourceUrl, rightsNote: input.rightsNote,
        contentHash: row.contentHash!, createdAt: now, updatedAt: now };
      const answers = new Set(Array.isArray(input.correctAnswer) ? input.correctAnswer : [input.correctAnswer]);
      const choices: Choice[] = input.choices.map((choice) => ({ id: makeId(), questionId: id, label: choice.label,
        text: choice.text, isCorrect: answers.has(choice.label) }));
      const media: QuestionMedia[] = input.media.map((item) => ({ id: makeId(), questionId: id, role: item.role,
        order: item.order, fileName: item.fileName, mimeType: item.mimeType, sha256: item.sha256,
        blob: new Blob([preview.files[item.path] as BlobPart], { type: item.mimeType }), createdAt: now }));
      await db.questions.add(question); await db.choices.bulkAdd(choices); if (media.length) await db.questionMedia.bulkAdd(media);
    }
  });
  return ready.length;
}

export function isCorrectAnswer(userAnswer: string | string[], correctAnswer: string | string[]) {
  const user = (Array.isArray(userAnswer) ? userAnswer : [userAnswer]).slice().sort();
  const correct = (Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer]).slice().sort();
  return user.length === correct.length && user.every((answer, i) => answer === correct[i]);
}
