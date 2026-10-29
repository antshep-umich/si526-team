import { afterEach, describe, expect, it, vi } from "vitest";
import { addDays, describeDay, formatDate, localDateOf, startOfWeek, toIsoDate, today } from "./dates.ts";

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
});
