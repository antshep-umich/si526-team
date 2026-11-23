// SCRUM-73 Schedule, end to end: the week strip counts a chore due today, the arrows reach
// next week's chore, "Today" comes back, and Month shows the month.
import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHousehold, expectHeading, launchBrowser, newPhone, signUp, uniqueEmail } from "./helpers.js";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser.close();
});

/** A date `days` from today on this machine (the browser's too), as "YYYY-MM-DD". */
function fromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "Thursday, Nov 19", the start of a day's accessible name in the week strip. */
const dayName = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

describe("the Schedule tab", () => {
  it("shows today's chores, steps to next week's, comes back with Today, and opens the month", async () => {
    const { page, context } = await newPhone(browser);
    await signUp(page, "E2E Planner", uniqueEmail("planner"));
    await expectHeading(page, "Your household");
    await createHousehold(page, "E2E Oak St");
    await page.getByRole("button", { name: "Go to household" }).click();
    await expectHeading(page, "E2E Oak St");

    const me = (await (await page.request.get("/api/households/current")).json()).members[0].userId as string;
    for (const [name, dueDate] of [
      ["E2E Sweep porch", fromToday(0)],
      ["E2E Clean gutters", fromToday(7)],
    ]) {
      const added = await page.request.post("/api/chores", { data: { name, assigneeId: me, dueDate } });
      expect(added.status()).toBe(201);
    }

    await page.getByRole("button", { name: "Schedule" }).click();
    await expectHeading(page, "Schedule");
    const today = page.getByRole("button", { name: `${dayName(fromToday(0))} (today): 1 chore` });
    await today.waitFor();
    expect(await today.getAttribute("aria-pressed")).toBe("true");
    await page.getByRole("list", { name: "Chores on this day" }).getByText("E2E Sweep porch").waitFor();

    await page.getByRole("button", { name: "Next week" }).click();
    await page.getByRole("button", { name: `${dayName(fromToday(7))}: 1 chore` }).click();
    await page.getByRole("list", { name: "Chores on this day" }).getByText("E2E Clean gutters").waitFor();

    await page.getByRole("button", { name: "Today" }).click();
    await page.getByRole("list", { name: "Chores on this day" }).getByText("E2E Sweep porch").waitFor();

    await page.getByRole("radio", { name: "Month" }).click();
    const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    await page.getByRole("heading", { level: 2, name: month }).waitFor();
    expect(await page.getByRole("list", { name: "Days of the month" }).getByRole("button").count()).toBeGreaterThanOrEqual(28);

    await context.close();
  });
});
