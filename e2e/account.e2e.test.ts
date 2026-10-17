// SCRUM-2 Sign Up and SCRUM-3 Log in and Log out, end to end.
import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createHousehold,
  expectHeading,
  fieldError,
  launchBrowser,
  logIn,
  logOut,
  newPhone,
  signUp,
  uniqueEmail,
} from "./helpers.js";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser.close();
});

describe("accounts", () => {
  it("signs up, logs out from the menu, rejects a wrong password and logs back in", async () => {
    const { context, page } = await newPhone(browser);
    const email = uniqueEmail("account");

    await signUp(page, "E2E Owner", email);
    await expectHeading(page, "Your household");
    await createHousehold(page, "E2E Account House");
    await page.getByRole("button", { name: "Go to household" }).click();
    await expectHeading(page, "E2E Account House");

    await logOut(page);

    await logIn(page, email, "not-the-password");
    expect(await fieldError(page, "Password")).toBe("That email and password don't match.");

    await logIn(page, email);
    await expectHeading(page, "E2E Account House");
    await context.close();
  });

  it("checks sign-up details and refuses an email that already has an account", async () => {
    const { context, page } = await newPhone(browser);
    const email = uniqueEmail("duplicate");

    await signUp(page, "E2E First", email);
    await expectHeading(page, "Your household");

    const second = await newPhone(browser);
    await second.page.goto("/");
    await second.page.getByRole("button", { name: "New here? Create an account" }).click();
    await second.page.getByLabel("Name", { exact: true }).fill("E2E Second");
    await second.page.getByLabel("Email", { exact: true }).fill(email);
    await second.page.getByLabel("Password", { exact: true }).fill("e2e-password-1");
    await second.page.getByLabel("Confirm password", { exact: true }).fill("e2e-password-2");
    await second.page.getByRole("button", { name: "Create account" }).click();
    expect(await fieldError(second.page, "Confirm password")).toBe("The passwords don't match.");

    await signUp(second.page, "E2E Second", email);
    expect(await fieldError(second.page, "Email")).toBe("An account already uses this email. Log in instead.");

    await second.context.close();
    await context.close();
  });

  it("keeps people signed in across a reload", async () => {
    const { context, page } = await newPhone(browser);

    await signUp(page, "E2E Reload", uniqueEmail("reload"));
    await expectHeading(page, "Your household");
    await page.reload();

    await expectHeading(page, "Your household");
    await context.close();
  });
});
