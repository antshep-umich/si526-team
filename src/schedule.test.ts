// The Schedule's dates and day lists (SCRUM-73), without the screen.
import { describe, expect, it } from "vitest";
import type { Chore } from "./chores.ts";
import {
  choresOnDay,
  dayHeading,
  daysFrom,
  periodLabel,
  periodOf,
  showsToday,
  stepSpot,
  summarizeDays,
} from "./schedule.ts";

const TODAY = "2026-10-29"; // a Thursday

function chore(id: string, dueDate: string, completedAt: string | null = null): Chore {
  return {
    id,
    name: id,
    notes: null,
    dueDate,
    assignee: null,
    createdBy: null,
    createdAt: "2026-10-01T12:00:00.000Z",
    completedAt,
    completedBy: null,
  };
}

describe("schedule periods", () => {
  it("a week runs Monday to Sunday, a month from its 1st to its last day", () => {
    expect(periodOf({ mode: "week", day: TODAY })).toEqual({ first: "2026-10-26", last: "2026-11-01" });
    expect(periodOf({ mode: "month", day: TODAY })).toEqual({ first: "2026-10-01", last: "2026-10-31" });
    expect(daysFrom("2026-10-26", "2026-11-01")).toHaveLength(7);
  });

  it("labels a week across two months the story's way, and a month by name", () => {
    expect(periodLabel({ mode: "week", day: TODAY })).toBe("Oct 26 to Nov 1");
    expect(periodLabel({ mode: "week", day: "2026-11-19" })).toBe("Nov 16 to Nov 22");
    expect(periodLabel({ mode: "month", day: TODAY })).toBe("October 2026");
  });

  it("heads the day as Figma does, adding the year only when it isn't this year's", () => {
    expect(dayHeading("2026-11-19", TODAY)).toBe("Thursday, Nov 19");
    expect(dayHeading("2027-01-04", TODAY)).toBe("Monday, Jan 4, 2027");
  });

  it("steps to the next or previous week or month, selecting its first day or else today", () => {
    expect(stepSpot({ mode: "week", day: TODAY }, 1, TODAY)).toEqual({ mode: "week", day: "2026-11-02" });
    expect(stepSpot({ mode: "week", day: "2026-11-04" }, -1, TODAY)).toEqual({ mode: "week", day: TODAY });
    expect(stepSpot({ mode: "month", day: TODAY }, -1, TODAY)).toEqual({ mode: "month", day: "2026-09-01" });
    expect(stepSpot({ mode: "month", day: "2026-12-31" }, 1, TODAY)).toEqual({ mode: "month", day: "2027-01-01" });
    expect(showsToday({ mode: "month", day: "2026-10-01" }, TODAY)).toBe(true);
  });
});

describe("schedule days", () => {
  const chores = [
    chore("old overdue", "2026-10-05"),
    chore("overdue", "2026-10-27"),
    chore("done tuesday", "2026-10-27", "2026-10-27T15:00:00.000Z"),
    chore("today", TODAY),
    chore("done today", TODAY, "2026-10-29T08:00:00.000Z"),
    chore("friday", "2026-10-30"),
  ];

  it("counts the chores due each day and marks a day with an overdue one", () => {
    const summary = summarizeDays(chores, daysFrom("2026-10-26", "2026-11-01"), TODAY);

    expect(summary.get("2026-10-26")).toEqual({ count: 0, overdue: false });
    expect(summary.get("2026-10-27")).toEqual({ count: 2, overdue: true });
    expect(summary.get(TODAY)).toEqual({ count: 2, overdue: false });
    expect(summary.get("2026-10-30")).toEqual({ count: 1, overdue: false });
    expect(summary.has("2026-10-05")).toBe(false);
  });

  it("lists a day's open chores before its done ones", () => {
    expect(choresOnDay(chores, "2026-10-27", TODAY).map((c) => c.id)).toEqual(["overdue", "done tuesday"]);
  });

  it("lists chores still overdue from earlier days first under today, oldest first", () => {
    expect(choresOnDay(chores, TODAY, TODAY).map((c) => c.id)).toEqual(["old overdue", "overdue", "today", "done today"]);
    expect(choresOnDay(chores, "2026-10-30", TODAY).map((c) => c.id)).toEqual(["friday"]);
  });
});
