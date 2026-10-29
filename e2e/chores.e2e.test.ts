// SCRUM-6 Add a Chore, SCRUM-7 View the Chore List and SCRUM-8 Mark a Chore Done,
// end to end, with two people in one household.
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ChoreListResponse } from "../shared/chores.js";
import { createHousehold, expectHeading, fieldError, launchBrowser, newPhone, signUp, uniqueEmail } from "./helpers.js";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser.close();
});

/** Today in this machine's time zone, which is also the test browser's. */
function localDate(daysFromToday = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function addChore(page: Page, name: string, assignee: string, dueDate: string) {
  await page.getByRole("button", { name: "Add chore" }).click();
  await expectHeading(page, "Add chore");
  await page.getByLabel("Chore name", { exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Assigned to" }).click();
  await page.getByRole("option", { name: assignee, exact: true }).click();
  await page.getByLabel("Due date", { exact: true }).fill(dueDate);
  await page.getByRole("button", { name: "Add chore" }).click();
}

const card = (page: Page, name: string) => page.getByRole("listitem").filter({ hasText: name });

describe("chores", () => {
  it("adds chores, shows them to the household, and lets only the assignee tick one off", async () => {
    const owner = await newPhone(browser);
    await signUp(owner.page, "E2E Owner", uniqueEmail("chores-owner"));
    await expectHeading(owner.page, "Your household");
    const inviteCode = await createHousehold(owner.page, "E2E Chore House");
    await owner.page.getByRole("button", { name: "Go to household" }).click();
    await expectHeading(owner.page, "E2E Chore House");
    await owner.page.getByText("No chores yet. Add the first one.").waitFor();

    const mate = await newPhone(browser);
    await signUp(mate.page, "E2E Mate", uniqueEmail("chores-mate"));
    await mate.page.getByRole("button", { name: "Join with a code" }).click();
    await mate.page.getByLabel("Invite code").fill(inviteCode);
    await mate.page.getByRole("button", { name: "Join" }).click();
    await expectHeading(mate.page, "E2E Chore House");

    // Saving an empty form shows every error at once.
    await owner.page.getByRole("button", { name: "Add chore" }).click();
    await owner.page.getByRole("button", { name: "Add chore" }).click();
    expect(await fieldError(owner.page, "Chore name")).toBe("Chore name is required.");
    expect(await fieldError(owner.page, "Due date")).toBe("Choose a due date.");
    await owner.page.getByRole("button", { name: "Cancel" }).click();
    await expectHeading(owner.page, "E2E Chore House");

    await addChore(owner.page, "E2E Mop kitchen", "E2E Mate", localDate());
    await expectHeading(owner.page, "E2E Chore House");
    await card(owner.page, "E2E Mop kitchen").getByText("E2E Mate · due today").waitFor();
    await addChore(owner.page, "E2E Water plants", "You", localDate(1));
    await card(owner.page, "E2E Water plants").getByText("You · due tomorrow").waitFor();

    // Only the assignee gets a checkbox.
    expect(await card(owner.page, "E2E Mop kitchen").getByRole("checkbox").count()).toBe(0);
    expect(await card(owner.page, "E2E Water plants").getByRole("checkbox").count()).toBe(1);

    // Mine shows only the owner's chore.
    await owner.page.getByRole("radio", { name: "Mine" }).click();
    await owner.page.getByText("E2E Mop kitchen").waitFor({ state: "detached" });
    expect(await owner.page.getByText("E2E Water plants").count()).toBe(1);

    // The housemate sees both, and marks theirs done.
    await mate.page.reload();
    await card(mate.page, "E2E Water plants").getByText("E2E Owner · due tomorrow").waitFor();
    await Promise.all([
      mate.page.waitForResponse((res) => res.url().endsWith("/complete") && res.ok()),
      mate.page.getByRole("checkbox", { name: "Mark E2E Mop kitchen done" }).click(),
    ]);
    const doneSection = mate.page.getByRole("button", { name: "Done (1)" });
    await doneSection.click();
    await card(mate.page, "E2E Mop kitchen").getByText("You · done today · due today").waitFor();

    const listed = (await (await mate.page.request.get("/api/chores")).json()) as ChoreListResponse;
    const mop = listed.chores.find((c) => c.name === "E2E Mop kitchen");
    expect(mop?.completedBy?.name).toBe("E2E Mate");

    // And undoes it.
    await mate.page.getByRole("checkbox", { name: "Mark E2E Mop kitchen not done" }).click();
    await doneSection.waitFor({ state: "detached" });
    await mate.page.getByRole("checkbox", { name: "Mark E2E Mop kitchen done" }).waitFor();

    await mate.context.close();
    await owner.context.close();
  });
});
