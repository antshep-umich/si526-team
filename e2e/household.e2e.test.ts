// SCRUM-4 Create a Household and SCRUM-5 Join a Household, end to end, with two people.
import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { HouseholdResponse } from "../shared/api.js";
import { createHousehold, expectHeading, fieldError, launchBrowser, newPhone, signUp, uniqueEmail } from "./helpers.js";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser.close();
});

describe("households", () => {
  it("creates a household, then a housemate joins it with the invite code", async () => {
    // The owner creates the household.
    const owner = await newPhone(browser);
    await signUp(owner.page, "E2E Owner", uniqueEmail("owner"));
    await expectHeading(owner.page, "Your household");
    const inviteCode = await createHousehold(owner.page, "E2E Maple St");

    expect(inviteCode).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    await owner.page.getByText("E2E Maple St is ready.", { exact: false }).waitFor();
    const members = owner.page.getByRole("listitem");
    expect(await members.count()).toBe(1);
    expect(await members.first().textContent()).toBe("YouOwner");

    await owner.page.getByRole("button", { name: "Go to household" }).click();
    await expectHeading(owner.page, "E2E Maple St");
    await owner.page.getByText("No chores yet. Add the first one.").waitFor();

    // A housemate tries a wrong code, then the real one typed loosely.
    const mate = await newPhone(browser);
    await signUp(mate.page, "E2E Housemate", uniqueEmail("mate"));
    await mate.page.getByRole("button", { name: "Join with a code" }).click();
    await expectHeading(mate.page, "Join a household");

    await mate.page.getByLabel("Invite code").fill("ZZZZZZZZ");
    await mate.page.getByRole("button", { name: "Join", exact: true }).click();
    expect(await fieldError(mate.page, "Invite code")).toBe(
      "No household has that code. Check it with your housemate and try again.",
    );

    const typedLoosely = `${inviteCode.slice(0, 4).toLowerCase()}-${inviteCode.slice(4).toLowerCase()}`;
    await mate.page.getByLabel("Invite code").fill(typedLoosely);
    await mate.page.getByRole("button", { name: "Join", exact: true }).click();
    await expectHeading(mate.page, "E2E Maple St");

    // Both now belong to the same household, and each sees the other's name.
    const response = await mate.page.request.get("/api/households/current");
    const household = (await response.json()) as HouseholdResponse;
    expect(household.role).toBe("member");
    expect(household.members.map((m) => [m.name, m.role])).toEqual([
      ["E2E Owner", "owner"],
      ["E2E Housemate", "member"],
    ]);

    await mate.context.close();
    await owner.context.close();
  });

  it("goes Back from Create and Join without creating anything", async () => {
    const { context, page } = await newPhone(browser);
    await signUp(page, "E2E Undecided", uniqueEmail("undecided"));

    await page.getByRole("button", { name: "Create a household" }).click();
    await expectHeading(page, "Create Household");
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: "Join with a code" }).click();
    await page.getByRole("button", { name: "Back" }).click();

    await expectHeading(page, "Your household");
    expect((await page.request.get("/api/households/current")).status()).toBe(404);
    await context.close();
  });
});
