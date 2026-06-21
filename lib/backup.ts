import { z } from "zod";
import { db, setSetting } from "./db";
import type { BackupEnvelope } from "./types";

const id = z.string().min(1), iso = z.string().datetime();
const question = z.object({ id, examYear:z.number().int(), subject:z.enum(["information","medical","system"]), questionNo:z.number().int(), body:z.string(), questionType:z.enum(["single_choice","multiple_choice","true_false_combination","other"]), correctAnswer:z.union([z.string(),z.array(z.string())]), explanation:z.string().optional(), topicSummary:z.string().optional(), source:z.string().optional(), sourceUrl:z.string().optional(), rightsNote:z.string().optional(), contentHash:z.string(), createdAt:iso, updatedAt:iso });
const choice = z.object({ id, questionId:id, label:z.string(), text:z.string(), isCorrect:z.boolean().optional() });
const attempt = z.object({ id, questionId:id, userAnswer:z.union([z.string(),z.array(z.string())]), isCorrect:z.boolean(), confidence:z.enum(["high","medium","low"]), elapsedSec:z.number().optional(), attemptedAt:iso });
const analysis = z.object({ id, attemptId:id, questionId:id, primaryReason:z.enum(["A","B","C","D","E","F"]), secondaryReasons:z.array(z.enum(["A","B","C","D","E","F"])), readingMistakeType:z.enum(["missed_negative","missed_positive","missed_best_answer","wrong_subject","missed_condition","missed_number_or_unit","other"]).optional(), note:z.string().optional(), createdAt:iso });
const card = z.object({ id, questionId:id.optional(), subject:z.enum(["information","medical","system"]), cardType:z.enum(["term","judgement","comparison","workflow","calculation","reading_mistake"]), front:z.string(), back:z.string(), tags:z.array(z.string()), dueAt:iso, intervalDays:z.number(), reviewCount:z.number(), successCount:z.number(), failureCount:z.number(), isImportant:z.boolean(), sourceReason:z.enum(["A","B","C","D","E","F"]).optional(), examWeekReviewedAt:iso.optional(), createdAt:iso, updatedAt:iso });
const schedule = z.object({ id, targetType:z.enum(["question","card"]), targetId:id, dueAt:iso, successStreak:z.number(), intervalDays:z.number(), updatedAt:iso });
const log = z.object({ id, targetType:z.enum(["question","card"]), targetId:id, result:z.enum(["good","hard","again"]), reviewedAt:iso });
const setting = z.object({ key:z.string(), value:z.unknown(), updatedAt:iso });
const backupSchema = z.object({
  schemaVersion: z.literal(1), exportedAt: z.string().datetime(), app: z.literal("medical-info-exam-dojo"),
  data: z.object({ questions: z.array(question), choices: z.array(choice), attempts: z.array(attempt),
    errorAnalyses: z.array(analysis), cards: z.array(card), reviewSchedules: z.array(schedule),
    reviewLogs: z.array(log), settings: z.array(setting) }).strict()
}).strict();

export async function createBackup(): Promise<BackupEnvelope> {
  const [questions, choices, attempts, errorAnalyses, cards, reviewSchedules, reviewLogs, settings] = await Promise.all([
    db.questions.toArray(), db.choices.toArray(), db.attempts.toArray(), db.errorAnalyses.toArray(), db.cards.toArray(),
    db.reviewSchedules.toArray(), db.reviewLogs.toArray(), db.settings.toArray()
  ]);
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), app: "medical-info-exam-dojo",
    data: { questions, choices, attempts, errorAnalyses, cards, reviewSchedules, reviewLogs, settings } };
}

export function parseBackup(text: string): BackupEnvelope {
  let input: unknown; try { input = JSON.parse(text); } catch { throw new Error("バックアップJSONの構文が正しくありません"); }
  const parsed = backupSchema.safeParse(input);
  if (!parsed.success) throw new Error("対応していない、または破損したバックアップです");
  const backup = parsed.data as BackupEnvelope;
  const questionIds = new Set(backup.data.questions.map((row) => row.id));
  const attemptIds = new Set(backup.data.attempts.map((row) => row.id));
  const cardIds = new Set(backup.data.cards.map((row) => row.id));
  if (backup.data.choices.some((row) => !questionIds.has(row.questionId)) || backup.data.attempts.some((row) => !questionIds.has(row.questionId)) ||
      backup.data.errorAnalyses.some((row) => !questionIds.has(row.questionId) || !attemptIds.has(row.attemptId)) ||
      backup.data.cards.some((row) => row.questionId && !questionIds.has(row.questionId)) ||
      backup.data.reviewSchedules.some((row) => row.targetType === "question" ? !questionIds.has(row.targetId) : !cardIds.has(row.targetId)) ||
      backup.data.reviewLogs.some((row) => row.targetType === "question" ? !questionIds.has(row.targetId) : !cardIds.has(row.targetId))) {
    throw new Error("バックアップ内のデータ参照が破損しています");
  }
  return backup;
}

export async function restoreBackup(backup: BackupEnvelope) {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await db.questions.bulkAdd(backup.data.questions); await db.choices.bulkAdd(backup.data.choices);
    await db.attempts.bulkAdd(backup.data.attempts); await db.errorAnalyses.bulkAdd(backup.data.errorAnalyses);
    await db.cards.bulkAdd(backup.data.cards); await db.reviewSchedules.bulkAdd(backup.data.reviewSchedules);
    await db.reviewLogs.bulkAdd(backup.data.reviewLogs); await db.settings.bulkAdd(backup.data.settings);
  });
}

export function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

export async function markBackupComplete() { await setSetting("lastBackupAt", new Date().toISOString()); }
