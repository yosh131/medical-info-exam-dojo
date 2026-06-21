import Dexie, { type EntityTable } from "dexie";
import type { AppSetting, Attempt, Card, Choice, ErrorAnalysis, Question, ReviewLog, ReviewSchedule } from "./types";

export class ExamDatabase extends Dexie {
  questions!: EntityTable<Question, "id">;
  choices!: EntityTable<Choice, "id">;
  attempts!: EntityTable<Attempt, "id">;
  errorAnalyses!: EntityTable<ErrorAnalysis, "id">;
  cards!: EntityTable<Card, "id">;
  reviewSchedules!: EntityTable<ReviewSchedule, "id">;
  reviewLogs!: EntityTable<ReviewLog, "id">;
  settings!: EntityTable<AppSetting, "key">;

  constructor() {
    super("medical-info-exam-dojo");
    this.version(1).stores({
      questions: "id, &[examYear+subject+questionNo], &contentHash, examYear, subject, questionNo",
      choices: "id, questionId, &[questionId+label]",
      attempts: "id, questionId, attemptedAt, isCorrect, confidence",
      errorAnalyses: "id, &attemptId, questionId, primaryReason, createdAt",
      cards: "id, questionId, subject, cardType, dueAt, isImportant, updatedAt",
      reviewSchedules: "id, &[targetType+targetId], dueAt, targetType, targetId",
      reviewLogs: "id, [targetType+targetId], reviewedAt, result",
      settings: "key, updatedAt"
    });
  }
}

export const db = new ExamDatabase();

export const makeId = () => crypto.randomUUID();
export const isoNow = () => new Date().toISOString();

export async function getSettings() {
  const rows = await db.settings.toArray();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value, updatedAt: isoNow() });
}
