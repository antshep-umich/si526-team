import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  addMonths,
  describeDay,
  endOfMonth,
  formatDate,
  formatMonth,
  localDateOf,
  startOfMonth,
  startOfWeek,
  toIsoDate,
  today,
} from "./dates.ts";

afterEach(() => {
  vi.useRealTimers();
});

describe("dates", () => {
  it("reads today in the phone's own time zone", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 29, 23, 30)); // 11:30 PM local on Oct 29

    expect(today()).toBe("2026-10-29");
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("gives the local date a timestamp fell on", () => {
    expect(localDateOf(new Date(2026, 9, 29, 0, 15).toISOString())).toBe("2026-10-29");
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it.each([
    ["2026-10-26", "2026-10-26"], // Monday
    ["2026-10-29", "2026-10-26"], // Thursday
    ["2026-11-01", "2026-10-26"], // Sunday ends the week
    ["2026-11-02", "2026-11-02"],
  ])("starts the week of %s on Monday %s", (day, monday) => {
    expect(startOfWeek(day)).toBe(monday);
  });

  it("writes dates as a short weekday and date, with the year only when it isn't this year", () => {
    expect(formatDate("2026-10-05", "2026-10-29")).toBe("Mon, Oct 5");
    expect(formatDate("2027-01-04", "2026-10-29")).toBe("Mon, Jan 4, 2027");
  });

  it.each([
    ["2026-10-29", "today"],
    ["2026-10-30", "tomorrow"],
    ["2026-10-28", "Wed, Oct 28"],
    ["2026-11-02", "Mon, Nov 2"],
  ])("describes %s as %s (SCRUM-7)", (day, words) => {
    expect(describeDay(day, "2026-10-29")).toBe(words);
  });

  it("finds the first and last day of a month", () => {
    expect(startOfMonth("2026-11-12")).toBe("2026-11-01");
    expect(endOfMonth("2026-11-12")).toBe("2026-11-30");
    expect(endOfMonth("2028-02-01")).toBe("2028-02-29"); // leap year
  });

  it("moves by whole months, across year ends and from long months to short ones", () => {
    expect(addMonths("2026-11-01", -1)).toBe("2026-10-01");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-01");
    expect(addMonths("2027-01-31", -2)).toBe("2026-11-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("names a month with its year", () => {
    expect(formatMonth("2026-10-01")).toBe("October 2026");
  });
});
