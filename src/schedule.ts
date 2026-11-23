// What the Schedule tab (SCRUM-73) shows: the days of a week or a month, how many chores are
// due on each, and the chores of the selected day. Dates are the phone's (src/dates.ts).
import { choreStatus, isDone, type Chore } from "./chores.ts";
import { addDays, addMonths, endOfMonth, startOfMonth, startOfWeek } from "./dates.ts";

export type ScheduleMode = "week" | "month";

/** Where the Schedule is: Week or Month, and the selected day ("YYYY-MM-DD"). */
export type ScheduleSpot = { mode: ScheduleMode; day: string };

export const SCHEDULE_MODES = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
] as const;

/** AC1: the current week with today selected. */
export const startingSpot = (today: string): ScheduleSpot => ({ mode: "week", day: today });

/** The first and last day of the week or month the selected day is in. */
export function periodOf({ mode, day }: ScheduleSpot): { first: string; last: string } {
  if (mode === "week") {
    const first = startOfWeek(day);
    return { first, last: addDays(first, 6) };
  }
  return { first: startOfMonth(day), last: endOfMonth(day) };
}

/** Every day from `first` to `last`. */
export function daysFrom(first: string, last: string): string[] {
  const days: string[] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) days.push(day);
  return days;
}

/**
 * The previous or next week or month (AC4). Its first day is selected, or today when it's
 * in there.
 */
export function stepSpot(spot: ScheduleSpot, step: -1 | 1, today: string): ScheduleSpot {
  const first =
    spot.mode === "week" ? addDays(startOfWeek(spot.day), 7 * step) : addMonths(spot.day, step);
  const { last } = periodOf({ mode: spot.mode, day: first });
  return { mode: spot.mode, day: today >= first && today <= last ? today : first };
}

/** Is today in the week or month shown? */
export function showsToday(spot: ScheduleSpot, today: string): boolean {
  const { first, last } = periodOf(spot);
  return today >= first && today <= last;
}

const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const monthDay = (iso: string) => parse(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** The range in the header (AC1): "Oct 26 to Nov 1", or "November 2026" for a month. */
export function periodLabel(spot: ScheduleSpot): string {
  const { first, last } = periodOf(spot);
  if (spot.mode === "month") return parse(first).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return `${monthDay(first)} to ${monthDay(last)}`;
}

/** The selected day's heading, as in Figma: "Thursday, Nov 19" (with the year if it isn't this year's). */
export function dayHeading(day: string, today: string): string {
  const options: Intl.DateTimeFormatOptions = { weekday: "long", month: "short", day: "numeric" };
  if (day.slice(0, 4) !== today.slice(0, 4)) options.year = "numeric";
  return parse(day).toLocaleDateString("en-US", options);
}

/** "Mon" … "Sun" for a date. */
export const weekdayShort = (day: string) => parse(day).toLocaleDateString("en-US", { weekday: "short" });

export type DaySummary = { count: number; overdue: boolean };

/** AC2: for each day, the chores due that day, and whether one of them is overdue. */
export function summarizeDays(chores: Chore[], days: string[], today: string): Map<string, DaySummary> {
  const summary = new Map<string, DaySummary>(days.map((day) => [day, { count: 0, overdue: false }]));
  for (const chore of chores) {
    const day = summary.get(chore.dueDate);
    if (!day) continue;
    day.count += 1;
    if (choreStatus(chore, today) === "overdue") day.overdue = true;
  }
  return summary;
}

/**
 * AC3: the chores on the selected day, open ones first. Under today, chores still overdue
 * from earlier days come first of all, so they aren't missed (Anthony, 2026-11-23); they
 * stay counted on the day they were due.
 */
export function choresOnDay(chores: Chore[], day: string, today: string): Chore[] {
  const byDue = (a: Chore, b: Chore) => a.dueDate.localeCompare(b.dueDate) || a.createdAt.localeCompare(b.createdAt);
  const carried = day === today ? chores.filter((c) => !isDone(c) && c.dueDate < today).sort(byDue) : [];
  const due = chores.filter((c) => c.dueDate === day);
  return [
    ...carried,
    ...due.filter((c) => !isDone(c)).sort(byDue),
    ...due.filter(isDone).sort((a, b) => a.completedAt!.localeCompare(b.completedAt!)),
  ];
}
