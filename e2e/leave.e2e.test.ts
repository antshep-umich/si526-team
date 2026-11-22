// SCRUM-75 Leave a household, end to end with two people: the leaver's open chore turns
// "Unassigned", the housemate is told, and the last member's leaving deletes the household.
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { HouseholdResponse } from "../shared/api.js";
import { createHousehold, expectHeading, launchBrowser, newPhone, signUp, uniqueEmail } from "./helpers.js";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser.close();
});

async function leave(page: Page) {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("menuitem", { name: "My profile" }).click();
  await page.getByRole("button", { name: "Leave household" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Leave", exact: true }).click();
  await expectHeading(page, "Your household");
}

describe("leaving a household", () => {
  it("unassigns the leaver's open chore, tells the housemate, and deletes the household with its last member", async () => {
    const owner = await newPhone(browser);
    await signUp(owner.page, "E2E Stayer", uniqueEmail("stayer"));
    await expectHeading(owner.page, "Your household");
    const inviteCode = await createHousehold(owner.page, "E2E Elm St");
    await owner.page.getByRole("button", { name: "Go to household" }).click();
    await expectHeading(owner.page, "E2E Elm St");

    const mate = await newPhone(browser);
    await signUp(mate.page, "E2E Leaver", uniqueEmail("leaver"));
    await expectHeading(mate.page, "Your household");
    const joined = await mate.page.request.post("/api/households/join", { data: { inviteCode } });
    const household = (await joined.json()) as HouseholdResponse;
    const mateId = household.members.find((m) => m.name === "E2E Leaver")!.userId;

    // A chore for the housemate, still open when they leave.
    const added = await owner.page.request.post("/api/chores", {
      data: { name: "E2E Rake leaves", assigneeId: mateId, dueDate: "2999-01-01" },
    });
    expect(added.status()).toBe(201);

    await mate.page.reload();
    await expectHeading(mate.page, "E2E Elm St");
    await leave(mate.page);

    // The owner's app finds the notice when it opens (and every 10 s after).
    await owner.page.reload();
    await owner.page.getByText("E2E Leaver left the household.").waitFor();
    await owner.page.getByRole("list", { name: "Chores to do" }).getByText("E2E Rake leaves").waitFor();
    const card = owner.page.getByRole("listitem").filter({ hasText: "E2E Rake leaves" });
    expect(await card.textContent()).toContain("Unassigned");
    const members = ((await (await owner.page.request.get("/api/households/current")).json()) as HouseholdResponse).members;
    expect(members.map((m) => m.name)).toEqual(["E2E Stayer"]);

    // The last member leaves: the household goes.
    await leave(owner.page);
    expect((await owner.page.request.get("/api/households/current")).status()).toBe(404);

    await mate.context.close();
    await owner.context.close();
  });
});
