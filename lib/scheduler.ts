import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { db, isoNow, makeId } from "./db";
import type { ReviewResult, ReviewSchedule, ReviewTargetType } from "./types";

export function nextReview(schedule: Pick<ReviewSchedule, "successStreak">, result: ReviewResult, now = new Date()) {
  if (result === "again") return { successStreak: 0, intervalDays: 1, dueAt: addDays(startOfDay(now), 1).toISOString() };
  if (result === "hard") return { successStreak: schedule.successStreak, intervalDays: 3, dueAt: addDays(startOfDay(now), 3).toISOString() };
  const successStreak = schedule.successStreak + 1;
  const intervalDays = successStreak <= 1 ? 3 : successStreak === 2 ? 7 : 14;
  return { successStreak, intervalDays, dueAt: addDays(startOfDay(now), intervalDays).toISOString() };
}

export async function ensureSchedule(targetType: ReviewTargetType, targetId: string, days = 1) {
  const id = `${targetType}:${targetId}`;
  const found = await db.reviewSchedules.get(id);
  if (found) return found;
  const schedule: ReviewSchedule = { id, targetType, targetId, dueAt: addDays(startOfDay(new Date()), days).toISOString(), successStreak: 0, intervalDays: days, updatedAt: isoNow() };
  await db.reviewSchedules.add(schedule); return schedule;
}

export async function recordReview(targetType: ReviewTargetType, targetId: string, result: ReviewResult, now = new Date()) {
  const schedule = await ensureSchedule(targetType, targetId);
  const next = nextReview(schedule, result, now);
  await db.transaction("rw", db.reviewSchedules, db.reviewLogs, db.cards, async () => {
    await db.reviewSchedules.update(schedule.id, { ...next, updatedAt: now.toISOString() });
    await db.reviewLogs.add({ id: makeId(), targetType, targetId, result, reviewedAt: now.toISOString() });
    if (targetType === "card") {
      const card = await db.cards.get(targetId);
      if (card) await db.cards.update(targetId, { dueAt: next.dueAt, intervalDays: next.intervalDays,
        reviewCount: card.reviewCount + 1, successCount: card.successCount + (result === "good" ? 1 : 0),
        failureCount: card.failureCount + (result === "again" ? 1 : 0), updatedAt: now.toISOString() });
    }
  });
}

export function inExamWeek(examDate?: string, now = new Date()) {
  if (!examDate) return false;
  const days = differenceInCalendarDays(startOfDay(new Date(examDate)), startOfDay(now));
  return days >= 0 && days <= 7;
}

export async function promoteImportantCards(examDate?: string, now = new Date()) {
  if (!inExamWeek(examDate, now)) return 0;
  const cards = await db.cards.where("isImportant").equals(1).toArray();
  let promoted = 0;
  await db.transaction("rw", db.cards, db.reviewSchedules, async () => {
    for (const card of cards) {
      if (card.examWeekReviewedAt && new Date(card.examWeekReviewedAt) >= addDays(new Date(examDate!), -7)) continue;
      const schedule = await ensureSchedule("card", card.id);
      if (new Date(schedule.dueAt) > now) { await db.reviewSchedules.update(schedule.id, { dueAt: now.toISOString(), updatedAt: now.toISOString() }); promoted++; }
    }
  });
  return promoted;
}
