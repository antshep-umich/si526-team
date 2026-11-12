// The chore histories: My chore history's filtering and sorting (SCRUM-44), and the
// wording all three histories share (SCRUM-44, 45, 46, 47). Status comes from the
// dates, as on the chore list.
import { choreStatus, isDone, isMine, type Chore } from "./chores.ts";
import { addDays, describeDay, formatDate, formatMonth, localDateOf } from "./dates.ts";

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

/** A chore's dates, one fact each: "Due today", "Done Wed, Oct 28" (or "Not done yet"), "Created Tue, Oct 20". */
export function historyDates(chore: Chore, today: string): { due: string; outcome: string; created: string } {
  return {
    due: `Due ${describeDay(chore.dueDate, today)}`,
    outcome: chore.completedAt ? `Done ${describeDay(localDateOf(chore.completedAt), today)}` : "Not done yet",
    created: `Created ${formatDate(localDateOf(chore.createdAt), today)}`,
  };
}

/** Every history row's first line: "Due Tue, Oct 27 · Done Wed, Oct 28", or "… · Not done yet". */
export function outcomeLine(chore: Chore, today: string): string {
  const { due, outcome } = historyDates(chore, today);
  return `${due} · ${outcome}`;
}

/** Who a chore is for, as the household histories show it: "You", a housemate's name, or "Unassigned". */
export function assigneeLabel(chore: Chore, userId: string): string {
  if (!chore.assignee) return "Unassigned";
  return isMine(chore, userId) ? "You" : chore.assignee.name;
}

/** A week, Monday to Sunday: "Nov 9–15", or "Oct 26 – Nov 1" across a month. */
export function weekRange(monday: string): string {
  const sunday = addDays(monday, 6);
  const month = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short" });
  const day = (iso: string) => Number(iso.slice(8));
  return month(monday) === month(sunday)
    ? `${month(monday)} ${day(monday)}–${day(sunday)}`
    : `${month(monday)} ${day(monday)} – ${month(sunday)} ${day(sunday)}`;
}

/** When something happened to a chore: "Wed, Oct 28 at 9:00 AM", or "Today at 3:00 PM". */
export function eventWhen(timestamp: string, today: string): string {
  const day = localDateOf(timestamp);
  const date = day === today ? "Today" : formatDate(day, today);
  // Newer ICU puts a narrow no-break space before AM/PM; a plain space reads the same.
  const time = new Date(timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(/ /g, " ");
  return `${date} at ${time}`;
}

export type HistoryGroup = { label: string; chores: Chore[] };

/** The date a sort orders by, which is also the date its month groups follow. Null: not done yet. */
function sortDate(chore: Chore, sort: HistorySort): string | null {
  if (sort === "created-newest") return localDateOf(chore.createdAt);
  if (sort === "completed-newest") return chore.completedAt ? localDateOf(chore.completedAt) : null;
  return chore.dueDate;
}

/**
 * Splits an already sorted list into runs by the month of the date it's sorted by
 * ("October 2026"), keeping the order. Sorted by completion, open chores come last
 * under "Not done yet".
 */
export function groupHistory(sorted: Chore[], sort: HistorySort): HistoryGroup[] {
  const groups: HistoryGroup[] = [];
  for (const chore of sorted) {
    const date = sortDate(chore, sort);
    const label = date ? formatMonth(date) : "Not done yet";
    const last = groups.at(-1);
    if (last?.label === label) last.chores.push(chore);
    else groups.push({ label, chores: [chore] });
  }
  return groups;
}

/** "2 of 3 done", counting late ones as done. */
export function doneTally(chores: Chore[]): string {
  return `${chores.filter(isDone).length} of ${chores.length} done`;
}

/** The status in words, for the opened chore. */
export function statusLabel(chore: Chore, today: string): string {
  return { pending: "To do", overdue: "Overdue", done: "Done", late: "Done late" }[choreStatus(chore, today)];
}
