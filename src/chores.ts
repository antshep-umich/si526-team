// What the chore list shows, worked out from the API's chores (SCRUM-7 and SCRUM-8).
// Status isn't stored: it comes from the dates, in the phone's time zone.
import type { ChoreResponse } from "../shared/chores.ts";
import type { ChoreStatus } from "./components/ChoreCard.tsx";
import { addDays, describeDay, localDateOf, startOfWeek } from "./dates.ts";

export type Chore = ChoreResponse;

/** The local date a done chore was finished, or null while it's open. */
function doneOn(chore: Chore): string | null {
  return chore.completedAt ? localDateOf(chore.completedAt) : null;
}

/**
 * pending: to do and not past due (no chip).
 * overdue: not done, and the due date has passed.
 * done: done on or before the due date.
 * late: done, but after the due date.
 */
export function choreStatus(chore: Chore, today: string): ChoreStatus {
  const completed = doneOn(chore);
  if (completed) return completed > chore.dueDate ? "late" : "done";
  return chore.dueDate < today ? "overdue" : "pending";
}

export const isDone = (chore: Chore) => chore.completedAt !== null;

/** True if the chore is assigned to this user (only they can tick it). */
export const isMine = (chore: Chore, userId: string) => chore.assignee?.userId === userId;

/**
 * The card's second line. "You" for the user's own chores, so the line speaks to the
 * person responsible. Open: "You · due today". Done: "Sam · done today · due Mon, Oct 5".
 */
export function choreDetails(chore: Chore, userId: string, today: string): string {
  const who = !chore.assignee ? "Unassigned" : isMine(chore, userId) ? "You" : chore.assignee.name;
  const due = `due ${describeDay(chore.dueDate, today)}`;
  const completed = doneOn(chore);
  return completed ? `${who} · done ${describeDay(completed, today)} · ${due}` : `${who} · ${due}`;
}

/** Chores still to do: overdue ones first, then the soonest due. */
export function openChores(chores: Chore[], today: string): Chore[] {
  const overdue = (chore: Chore) => (chore.dueDate < today ? 0 : 1);
  return chores
    .filter((chore) => !isDone(chore))
    .sort(
      (a, b) =>
        overdue(a) - overdue(b) ||
        a.dueDate.localeCompare(b.dueDate) ||
        a.createdAt.localeCompare(b.createdAt),
    );
}

const thisWeek = (date: string, today: string) => {
  const monday = startOfWeek(today);
  return date >= monday && date <= addDays(monday, 6);
};

/** Chores finished this week (Monday to Sunday), most recent first. */
export function doneThisWeek(chores: Chore[], today: string): Chore[] {
  return chores
    .filter((chore) => {
      const completed = doneOn(chore);
      return completed !== null && thisWeek(completed, today);
    })
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
}

/** The progress card: of the chores due this week, how many are done, and how many of those late. */
export function weeklyProgress(chores: Chore[], today: string): { done: number; total: number; late: number } {
  const due = chores.filter((chore) => thisWeek(chore.dueDate, today));
  const statuses = due.map((chore) => choreStatus(chore, today));
  return {
    total: due.length,
    done: statuses.filter((status) => status === "done" || status === "late").length,
    late: statuses.filter((status) => status === "late").length,
  };
}
