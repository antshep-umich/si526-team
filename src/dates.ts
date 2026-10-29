// Calendar dates written "YYYY-MM-DD", read in the phone's own time zone. A chore is
// due on a day, not at a time, so "today" is whatever day it is where the user is.

/** The local calendar date of a moment, as "YYYY-MM-DD". */
export function toIsoDate(moment: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`;
}

/** Today's date on this phone. */
export function today(now: Date = new Date()): string {
  return toIsoDate(now);
}

/** The local date a timestamp (such as completedAt) fell on. */
export function localDateOf(timestamp: string): string {
  return toIsoDate(new Date(timestamp));
}

/** Local midnight at the start of a "YYYY-MM-DD" date. */
function parse(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

export function addDays(iso: string, days: number): string {
  const date = parse(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** The Monday of the week a date is in. Weeks run Monday to Sunday. */
export function startOfWeek(iso: string): string {
  const daysSinceMonday = (parse(iso).getDay() + 6) % 7;
  return addDays(iso, -daysSinceMonday);
}

/** "Mon, Oct 5", with the year added when it isn't this year's. */
export function formatDate(iso: string, todayIso: string): string {
  const date = parse(iso);
  const options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
  if (date.getFullYear() !== parse(todayIso).getFullYear()) options.year = "numeric";
  return date.toLocaleDateString("en-US", options);
}

/** "today", "tomorrow", or else formatDate's "Mon, Oct 5" (SCRUM-7). */
export function describeDay(iso: string, todayIso: string): string {
  if (iso === todayIso) return "today";
  if (iso === addDays(todayIso, 1)) return "tomorrow";
  return formatDate(iso, todayIso);
}
