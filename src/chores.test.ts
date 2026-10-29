import { describe, expect, it } from "vitest";
import {
  choreDetails,
  choreStatus,
  doneThisWeek,
  isMine,
  openChores,
  weeklyProgress,
  type Chore,
} from "./chores.ts";

// Thursday, Oct 29 2026. Its week runs Monday Oct 26 to Sunday Nov 1.
const TODAY = "2026-10-29";

/** A local time on a date, as the API's ISO timestamp. */
const at = (day: string, hour = 12) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!, hour).toISOString();
};

const ana = { userId: "u-ana", name: "Ana Lopez" };
const ben = { userId: "u-ben", name: "Ben Ito" };

function chore(name: string, fields: Partial<Chore> = {}): Chore {
  return {
    id: name,
    name,
    notes: null,
    dueDate: TODAY,
    assignee: ana,
    createdBy: ana,
    createdAt: at("2026-10-20"),
    completedAt: null,
    completedBy: null,
    ...fields,
  };
}

const done = (name: string, dueDate: string, completedOn: string, fields: Partial<Chore> = {}) =>
  chore(name, { dueDate, completedAt: at(completedOn), completedBy: ana, ...fields });

describe("choreStatus", () => {
  it.each([
    ["to do, due today", chore("a"), "pending"],
    ["to do, due later", chore("a", { dueDate: "2026-11-02" }), "pending"],
    ["not done, due yesterday", chore("a", { dueDate: "2026-10-28" }), "overdue"],
    ["done on the due date", done("a", TODAY, TODAY), "done"],
    ["done early", done("a", "2026-10-30", TODAY), "done"],
    ["done after the due date", done("a", "2026-10-27", "2026-10-28"), "late"],
  ] as const)("%s → %s", (_label, c, status) => {
    expect(choreStatus(c, TODAY)).toBe(status);
  });

  it("uses the local day it was done, not the time", () => {
    // 11 PM on the due date is still on time.
    expect(choreStatus(chore("a", { completedAt: at(TODAY, 23) }), TODAY)).toBe("done");
  });
});

describe("choreDetails", () => {
  it("calls the user's own chores \"You\" and names everyone else's", () => {
    expect(choreDetails(chore("a"), "u-ana", TODAY)).toBe("You · due today");
    expect(choreDetails(chore("a", { assignee: ben, dueDate: "2026-10-30" }), "u-ana", TODAY)).toBe(
      "Ben Ito · due tomorrow",
    );
  });

  it("shows when a done chore was finished and when it was due (SCRUM-8)", () => {
    expect(choreDetails(done("a", "2026-10-27", "2026-10-28"), "u-ana", TODAY)).toBe(
      "You · done Wed, Oct 28 · due Tue, Oct 27",
    );
  });

  it("says Unassigned if the assignee's account is gone", () => {
    expect(choreDetails(chore("a", { assignee: null }), "u-ana", TODAY)).toBe("Unassigned · due today");
  });
});

describe("openChores", () => {
  it("puts overdue chores first, then the soonest due, and leaves done ones out", () => {
    const list = [
      chore("later", { dueDate: "2026-11-05" }),
      chore("today"),
      done("done", TODAY, TODAY),
      chore("overdue", { dueDate: "2026-10-20" }),
      chore("tomorrow", { dueDate: "2026-10-30" }),
    ];

    expect(openChores(list, TODAY).map((c) => c.name)).toEqual(["overdue", "today", "tomorrow", "later"]);
  });

  it("keeps chores due the same day in the order they were added", () => {
    const list = [chore("second", { createdAt: at("2026-10-21") }), chore("first", { createdAt: at("2026-10-20") })];

    expect(openChores(list, TODAY).map((c) => c.name)).toEqual(["first", "second"]);
  });
});

describe("doneThisWeek", () => {
  it("lists chores done since Monday, most recent first", () => {
    const list = [
      done("monday", TODAY, "2026-10-26"),
      done("last sunday", "2026-10-25", "2026-10-25"),
      done("today", TODAY, TODAY),
      chore("open"),
    ];

    expect(doneThisWeek(list, TODAY).map((c) => c.name)).toEqual(["today", "monday"]);
  });
});

describe("weeklyProgress", () => {
  it("counts the chores due this week, the done ones, and how many of those were late", () => {
    const list = [
      chore("open"),
      done("on time", "2026-10-27", "2026-10-27"),
      done("late", "2026-10-26", "2026-10-28"),
      chore("next week", { dueDate: "2026-11-02" }),
      done("last week, done this week", "2026-10-23", "2026-10-26"),
    ];

    expect(weeklyProgress(list, TODAY)).toEqual({ total: 3, done: 2, late: 1 });
  });

  it("is empty with no chores due this week", () => {
    expect(weeklyProgress([], TODAY)).toEqual({ total: 0, done: 0, late: 0 });
  });
});

describe("isMine", () => {
  it("is true only for the assignee", () => {
    expect(isMine(chore("a"), "u-ana")).toBe(true);
    expect(isMine(chore("a"), "u-ben")).toBe(false);
    expect(isMine(chore("a", { assignee: null }), "u-ana")).toBe(false);
  });
});
