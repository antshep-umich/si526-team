// Filtering, sorting and wording for My chore history (SCRUM-44).
import { describe, expect, it } from "vitest";
import type { Chore } from "./chores.ts";
import {
  assigneeLabel,
  eventWhen,
  filterHistory,
  groupHistory,
  historyDates,
  isHistorySort,
  doneTally,
  outcomeLine,
  sortHistory,
  statusLabel,
  weekRange,
} from "./history.ts";

const at = (day: string, hour = 9) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!, hour).toISOString();
};

function chore(name: string, fields: Partial<Chore> = {}): Chore {
  return {
    id: name,
    name,
    notes: null,
    dueDate: "2026-10-29",
    assignee: null,
    createdBy: null,
    createdAt: at("2026-10-20"),
    completedAt: null,
    completedBy: null,
    ...fields,
  };
}

const TODAY = "2026-10-29";
const open1 = chore("open1", { dueDate: "2026-10-30", createdAt: at("2026-10-25") });
const open2 = chore("open2", { dueDate: "2026-10-20", createdAt: at("2026-10-10") });
const done1 = chore("done1", { dueDate: "2026-10-25", createdAt: at("2026-10-22"), completedAt: at("2026-10-24") });
const done2 = chore("done2", { dueDate: "2026-10-27", createdAt: at("2026-10-01"), completedAt: at("2026-10-28") });
const all = [open1, open2, done1, done2];
const ids = (chores: Chore[]) => chores.map((c) => c.id);

describe("chore history", () => {
  it("filters by completion status", () => {
    expect(ids(filterHistory(all, "all"))).toEqual(["open1", "open2", "done1", "done2"]);
    expect(ids(filterHistory(all, "done"))).toEqual(["done1", "done2"]);
    expect(ids(filterHistory(all, "open"))).toEqual(["open1", "open2"]);
  });

  it("sorts by due date, creation date or completion date without changing the input", () => {
    expect(ids(sortHistory(all, "due-newest"))).toEqual(["open1", "done2", "done1", "open2"]);
    expect(ids(sortHistory(all, "due-oldest"))).toEqual(["open2", "done1", "done2", "open1"]);
    expect(ids(sortHistory(all, "created-newest"))).toEqual(["open1", "done1", "open2", "done2"]);
    expect(ids(sortHistory(all, "completed-newest"))).toEqual(["done2", "done1", "open1", "open2"]);
    expect(ids(all)).toEqual(["open1", "open2", "done1", "done2"]);
  });

  it("describes a chore's dates, one fact each", () => {
    expect(historyDates(open1, TODAY)).toEqual({
      due: "Due tomorrow",
      outcome: "Not done yet",
      created: "Created Sun, Oct 25",
    });
    expect(historyDates(done2, TODAY)).toEqual({
      due: "Due Tue, Oct 27",
      outcome: "Done Wed, Oct 28",
      created: "Created Thu, Oct 1",
    });
  });

  it("puts when a chore was due and what happened on one line", () => {
    expect(outcomeLine(open1, TODAY)).toBe("Due tomorrow · Not done yet");
    expect(outcomeLine(done2, TODAY)).toBe("Due Tue, Oct 27 · Done Wed, Oct 28");
  });

  it("names who a chore is assigned to, as You for the current user", () => {
    const ana = { userId: "u-ana", name: "Ana Lopez" };
    const sam = { userId: "u-sam", name: "Sam Ito" };
    expect(assigneeLabel(chore("a", { assignee: ana }), "u-ana")).toBe("You");
    expect(assigneeLabel(chore("b", { assignee: sam }), "u-ana")).toBe("Sam Ito");
    expect(assigneeLabel(chore("c", { assignee: null }), "u-ana")).toBe("Unassigned");
  });

  it("names a week by its dates, compactly", () => {
    expect(weekRange("2026-11-09")).toBe("Nov 9–15");
    expect(weekRange("2026-10-26")).toBe("Oct 26 – Nov 1");
  });

  it("says when something happened to a chore, with the time", () => {
    expect(eventWhen(at("2026-10-28", 9), TODAY)).toBe("Wed, Oct 28 at 9:00 AM");
    expect(eventWhen(at("2026-10-29", 15), TODAY)).toBe("Today at 3:00 PM");
  });

  describe("grouping by month", () => {
    const sept = chore("sept", { dueDate: "2026-09-28", createdAt: at("2026-09-02"), completedAt: at("2026-10-02") });
    const nov = chore("nov", { dueDate: "2026-11-03", createdAt: at("2026-10-31") });
    const groups = (chores: Chore[], sort: Parameters<typeof sortHistory>[1]) =>
      groupHistory(sortHistory(chores, sort), sort).map((g) => [g.label, ids(g.chores)]);

    it("groups by the month of the date the list is sorted by, keeping the sort order", () => {
      expect(groups([...all, sept, nov], "due-newest")).toEqual([
        ["November 2026", ["nov"]],
        ["October 2026", ["open1", "done2", "done1", "open2"]],
        ["September 2026", ["sept"]],
      ]);
      expect(groups([...all, sept, nov], "due-oldest")).toEqual([
        ["September 2026", ["sept"]],
        ["October 2026", ["open2", "done1", "done2", "open1"]],
        ["November 2026", ["nov"]],
      ]);
    });

    it("uses the month each chore was created when sorted by creation date", () => {
      expect(groups([open1, sept, nov], "created-newest")).toEqual([
        ["October 2026", ["nov", "open1"]],
        ["September 2026", ["sept"]],
      ]);
    });

    it("uses the completion month when sorted by completion date, with open chores last", () => {
      expect(groups([open1, done1, sept, nov], "completed-newest")).toEqual([
        ["October 2026", ["done1", "sept"]],
        ["Not done yet", ["nov", "open1"]],
      ]);
    });

    it("counts a group's done chores, late ones included", () => {
      expect(doneTally([open1, done1, done2])).toBe("2 of 3 done");
      expect(doneTally([open1])).toBe("0 of 1 done");
    });
  });

  it("names the status", () => {
    expect([open1, open2, done1, done2].map((c) => statusLabel(c, TODAY))).toEqual([
      "To do",
      "Overdue",
      "Done",
      "Done late",
    ]);
  });

  it("knows its sort options", () => {
    expect(isHistorySort("due-oldest")).toBe(true);
    expect(isHistorySort("name")).toBe(false);
  });
});
