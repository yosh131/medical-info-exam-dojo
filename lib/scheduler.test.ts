import { describe, expect, it } from "vitest";
import { differenceInCalendarDays } from "date-fns";
import { inExamWeek, nextReview } from "./scheduler";

const now = new Date("2026-06-21T03:00:00.000Z");
describe("review scheduler",()=>{
  it.each([[0,3],[1,7],[2,14],[5,14]])("advances good streak %i by %i days",(streak,days)=>{
    const result=nextReview({successStreak:streak},"good",now);expect(result.intervalDays).toBe(days);expect(differenceInCalendarDays(new Date(result.dueAt),now)).toBe(days);
  });
  it("resets an incorrect review to tomorrow",()=>expect(nextReview({successStreak:3},"again",now)).toMatchObject({successStreak:0,intervalDays:1}));
  it("keeps the streak for hard",()=>expect(nextReview({successStreak:2},"hard",now)).toMatchObject({successStreak:2,intervalDays:3}));
  it("detects exam week",()=>expect(inExamWeek("2026-06-27",now)).toBe(true));
});
