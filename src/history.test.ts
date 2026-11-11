// Filtering, sorting and wording for My chore history (SCRUM-44).
import { describe, expect, it } from "vitest";
import type { Chore } from "./chores.ts";
import { filterHistory, historyDetails, isHistorySort, sortHistory, statusLabel } from "./history.ts";

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

  it("describes a chore's dates", () => {
    expect(historyDetails(open1, TODAY)).toBe("Created Sun, Oct 25 · due tomorrow · not done");
    expect(historyDetails(done2, TODAY)).toBe("Created Thu, Oct 1 · due Tue, Oct 27 · done Wed, Oct 28");
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
