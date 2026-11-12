// The household's chore history by month (SCRUM-47 View household chore history - monthly).
// A chore belongs to the month it's due in, the way the Home progress card counts a
// chore in the week it's due. Status comes from the dates, as on the chore list.
import { isDone, type Chore } from "./chores.ts";
import { endOfMonth, startOfMonth } from "./dates.ts";

/** The chores due in the month `month` is in, latest due first. */
export function choresDueInMonth(chores: Chore[], month: string): Chore[] {
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  return chores
    .filter((chore) => chore.dueDate >= first && chore.dueDate <= last)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate) || b.createdAt.localeCompare(a.createdAt));
}

export type MonthSummary = { completed: number; incomplete: number; overdue: number };

/**
 * The summary's three numbers. Completed: done, on time or late. Incomplete: not done.
 * Overdue: not done and past due, so overdue chores are also counted as incomplete
 * (the weekly view counts them the same way).
 */
export function monthSummary(chores: Chore[], today: string): MonthSummary {
  const open = chores.filter((chore) => !isDone(chore));
  return {
    completed: chores.length - open.length,
    incomplete: open.length,
    overdue: open.filter((chore) => chore.dueDate < today).length,
  };
}
