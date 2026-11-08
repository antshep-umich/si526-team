// The person's own chore history (SCRUM-44 View user chore history): filtering,
// sorting and the card's second line. Status comes from the dates, as on the chore list.
import { choreStatus, isDone, type Chore } from "./chores.ts";
import { describeDay, formatDate, localDateOf } from "./dates.ts";

export type HistoryFilter = "all" | "done" | "open";
export type HistorySort = "due-newest" | "due-oldest" | "created-newest" | "completed-newest";

export const HISTORY_FILTERS = [
  { id: "all", label: "All" },
  { id: "done", label: "Done" },
  { id: "open", label: "Not done" },
] as const;

export const HISTORY_SORTS = [
  { value: "due-newest", label: "Due date, newest first" },
  { value: "due-oldest", label: "Due date, oldest first" },
  { value: "created-newest", label: "Date created, newest first" },
  { value: "completed-newest", label: "Date completed, newest first" },
] as const satisfies readonly { value: HistorySort; label: string }[];

export function isHistorySort(value: string): value is HistorySort {
  return HISTORY_SORTS.some((sort) => sort.value === value);
}

export function filterHistory(chores: Chore[], filter: HistoryFilter): Chore[] {
  if (filter === "done") return chores.filter(isDone);
  if (filter === "open") return chores.filter((chore) => !isDone(chore));
  return chores;
}

const byDueNewest = (a: Chore, b: Chore) =>
  b.dueDate.localeCompare(a.dueDate) || b.createdAt.localeCompare(a.createdAt);

/** A sorted copy. "Date completed" puts done chores first (latest first), then open ones by due date. */
export function sortHistory(chores: Chore[], sort: HistorySort): Chore[] {
  const sorted = [...chores];
  switch (sort) {
    case "due-newest":
      return sorted.sort(byDueNewest);
    case "due-oldest":
      return sorted.sort((a, b) => byDueNewest(b, a));
    case "created-newest":
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "completed-newest":
      return sorted.sort((a, b) => {
        if (a.completedAt && b.completedAt) return b.completedAt.localeCompare(a.completedAt);
        if (a.completedAt) return -1;
        if (b.completedAt) return 1;
        return byDueNewest(a, b);
      });
  }
}

/** "Created Oct 20 · due today · done Oct 28", or "… · not done" while open. */
export function historyDetails(chore: Chore, today: string): string {
  const created = `Created ${formatDate(localDateOf(chore.createdAt), today)}`;
  const due = `due ${describeDay(chore.dueDate, today)}`;
  const done = chore.completedAt ? `done ${describeDay(localDateOf(chore.completedAt), today)}` : "not done";
  return `${created} · ${due} · ${done}`;
}

/** The status in words, for the opened chore. */
export function statusLabel(chore: Chore, today: string): string {
  return { pending: "To do", overdue: "Overdue", done: "Done", late: "Done late" }[choreStatus(chore, today)];
}
