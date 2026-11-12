import { describe, expect, it } from "vitest";
import { seedTarget, teamToday, testHouseChores, type SeedChore } from "./testHouse.js";

describe("test household seed", () => {
  it("only writes to a preview's database, or to the dev database when asked", () => {
    expect(seedTarget({ VERCEL: "1", VERCEL_ENV: "preview" }, [])).toBe("preview");
    expect(seedTarget({ VERCEL: "1", VERCEL_ENV: "production" }, [])).toBeNull();
    expect(seedTarget({ VERCEL: "1" }, ["--local"])).toBeNull();
    expect(seedTarget({}, [])).toBeNull();
    expect(seedTarget({}, ["--local"])).toBe("local");
  });

  it("counts today in Michigan, not on the build server", () => {
    // 2 AM UTC on Nov 13 is still the evening of Nov 12 in Ann Arbor.
    expect(teamToday(new Date("2026-11-13T02:00:00Z"))).toBe("2026-11-12");
  });

  it("dates the chores from today, with histories that match them", () => {
    const today = "2026-11-12";
    const chores = testHouseChores(today);
    const endOfToday = Date.parse(`${today}T00:00:00Z`) + 86_400_000;

    for (const chore of chores) {
      const times = chore.events.map((event) => event.createdAt.getTime());
      expect(times, chore.name).toEqual([...times].sort((a, b) => a - b));
      expect(Math.max(...times), chore.name).toBeLessThan(endOfToday);
      expect(chore.events[0], chore.name).toMatchObject({ eventType: "created", createdAt: chore.createdAt });
      const last = chore.events.at(-1)!;
      if (chore.completedAt) expect(last, chore.name).toMatchObject({ eventType: "completed", createdAt: chore.completedAt });
      else expect(last.eventType, chore.name).not.toBe("completed");
    }

    const status = (chore: SeedChore) =>
      chore.completedAt
        ? chore.completedAt.toISOString().slice(0, 10) > chore.dueDate ? "late" : "done"
        : chore.dueDate < today ? "overdue" : "to do";
    expect(new Set(chores.map(status))).toEqual(new Set(["to do", "overdue", "done", "late"]));

    const rescheduled = chores.find((chore) => chore.name === "Wipe down the kitchen counters")!;
    expect(rescheduled.dueDate).toBe("2026-11-06");
    expect(rescheduled.events.map((event) => [event.eventType, event.dueDate])).toEqual([
      ["created", "2026-11-05"],
      ["due_date_changed", "2026-11-06"],
      ["completed", "2026-11-06"],
      ["reopened", "2026-11-06"],
      ["completed", "2026-11-06"],
    ]);
  });
});
