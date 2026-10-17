// The stand-in "Forgot your password?" flow, end to end (TECH_DEBT #7).
import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { expectHeading, fieldError, launchBrowser, logIn, newPhone, PASSWORD, signUp, uniqueEmail } from "./helpers.js";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser.close();
});

describe("forgot password", () => {
  it("sets a new password from the email alone; the old one stops working", async () => {
    const email = uniqueEmail("reset");
    const signedUp = await newPhone(browser);
    await signUp(signedUp.page, "E2E Forgetful", email);
    await expectHeading(signedUp.page, "Your household");

    // On another device, signed out.
    const { context, page } = await newPhone(browser);
    await page.goto("/");
    await page.getByRole("button", { name: "Forgot your password?" }).click();
    await expectHeading(page, "Reset password");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Continue" }).click();
    await expectHeading(page, "Set a new password");
    await page.getByLabel("New password", { exact: true }).fill("e2e-new-password-1");
    await page.getByLabel("Confirm new password", { exact: true }).fill("e2e-new-password-1");
    await page.getByRole("button", { name: "Save new password" }).click();

    await page.getByText("Password updated. Log in with your new password.").waitFor();
    expect(await page.getByLabel("Email", { exact: true }).inputValue()).toBe(email);

    // The reset signed the first device out everywhere.
    await signedUp.page.reload();
    await expectHeading(signedUp.page, "Log in");

    await logIn(page, email, PASSWORD);
    expect(await fieldError(page, "Password")).toBe("That email and password don't match.");
    await logIn(page, email, "e2e-new-password-1");
    await expectHeading(page, "Your household");

    await context.close();
    await signedUp.context.close();
  });

  it("says when no account uses the email", async () => {
    const { context, page } = await newPhone(browser);
    await page.goto("/");
    await page.getByRole("button", { name: "Forgot your password?" }).click();
    await page.getByLabel("Email", { exact: true }).fill(uniqueEmail("nobody"));
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("New password", { exact: true }).fill("e2e-new-password-1");
    await page.getByLabel("Confirm new password", { exact: true }).fill("e2e-new-password-1");
    await page.getByRole("button", { name: "Save new password" }).click();

    expect(await fieldError(page, "Email")).toBe("No account uses that email.");
    await context.close();
  });
});
