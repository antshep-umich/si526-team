import { describe, expect, it } from "vitest";
import type { Chore } from "./chores.ts";
import { choresDueInMonth, monthlyDetails, monthSummary } from "./monthlyHistory.ts";

const at = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 9).toISOString();
};

function chore(name: string, dueDate: string, fields: Partial<Chore> = {}): Chore {
  return {
    id: name,
    name,
    notes: null,
    dueDate,
    assignee: { userId: "u-ana", name: "Ana Lopez" },
    createdBy: null,
    createdAt: at("2026-09-01"),
    completedAt: null,
    completedBy: null,
    ...fields,
  };
}

const TODAY = "2026-11-12";

describe("monthly household history", () => {
  it("keeps the chores due in the month, first and last day included, latest due first", () => {
    const chores = [
      chore("Sep 30", "2026-09-30"),
      chore("Oct 1", "2026-10-01"),
      chore("Oct 31", "2026-10-31"),
      chore("Nov 1", "2026-11-01"),
      chore("Oct 15 older", "2026-10-15", { createdAt: at("2026-09-02") }),
      chore("Oct 15 newer", "2026-10-15", { createdAt: at("2026-09-03") }),
    ];

    const names = choresDueInMonth(chores, "2026-10-01").map((c) => c.name);

    expect(names).toEqual(["Oct 31", "Oct 15 newer", "Oct 15 older", "Oct 1"]);
    expect(chores[0]!.name).toBe("Sep 30"); // the input isn't reordered
  });

  it("puts a chore in the month it's due, not the month it was done", () => {
    const late = chore("Rake leaves", "2026-10-31", { completedAt: at("2026-11-01") });

    expect(choresDueInMonth([late], "2026-10-01")).toEqual([late]);
    expect(choresDueInMonth([late], "2026-11-01")).toEqual([]);
  });

  it("counts completed, incomplete and overdue; overdue chores are also incomplete", () => {
    const chores = [
      chore("done on time", "2026-11-05", { completedAt: at("2026-11-04") }),
      chore("done late", "2026-11-06", { completedAt: at("2026-11-08") }),
      chore("overdue", "2026-11-10"),
      chore("due today", TODAY),
      chore("due later", "2026-11-20"),
    ];

    expect(monthSummary(chores, TODAY)).toEqual({ completed: 2, incomplete: 3, overdue: 1 });
    expect(monthSummary([], TODAY)).toEqual({ completed: 0, incomplete: 0, overdue: 0 });
  });

  it("describes who, when it's due and when it was done", () => {
    const done = chore("Wash dishes", "2026-11-05", { completedAt: at("2026-11-04") });
    const open = chore("Buy soap", TODAY, { assignee: { userId: "u-sam", name: "Sam Ito" } });
    const orphan = chore("Sweep", "2026-11-13", { assignee: null });

    expect(monthlyDetails(done, "u-ana", TODAY)).toBe("You · due Thu, Nov 5 · done Wed, Nov 4");
    expect(monthlyDetails(open, "u-ana", TODAY)).toBe("Sam Ito · due today · not done");
    expect(monthlyDetails(orphan, "u-ana", TODAY)).toBe("Unassigned · due tomorrow · not done");
  });
});
