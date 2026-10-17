import { readFileSync, writeFileSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { inject } from "vitest";
import { AUTH_PACING_FILE } from "./pacing.js";

// Shared steps for the e2e tests. They drive the app the way a person would: by
// visible labels and button names, at the Figma phone size.

export const baseURL = inject("baseURL");
export const remote = inject("remote");

export const PASSWORD = "e2e-password-1";

let counter = 0;
/** A fresh address for each account, ending @e2e.test so cleanup can find it. */
export function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${++counter}@e2e.test`;
}

export function launchBrowser(): Promise<Browser> {
  return chromium.launch();
}

/** A new phone-sized browser session with its own cookies (a separate person). */
export async function newPhone(
  browser: Browser,
  colorScheme: "light" | "dark" = "light",
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL, viewport: { width: 402, height: 874 }, colorScheme });
  context.setDefaultTimeout(20_000);
  return { context, page: await context.newPage() };
}

// Deployed sites rate-limit sign-in and sign-up (Better Auth's default: 3 requests,
// and the count only resets after 10 seconds with no request). This copies that
// rule so tests wait instead of getting "Too many tries". Locally there's no limit.
// The count lives in a file because each test file gets its own copy of this module,
// while the server counts requests from all of them.
async function paceAuthRequest() {
  if (!remote) return;
  const quietMs = 10_500;
  const pacing = JSON.parse(readFileSync(AUTH_PACING_FILE, "utf8")) as { count: number; last: number };
  if (Date.now() - pacing.last >= quietMs) pacing.count = 0;
  if (pacing.count >= 3) {
    await new Promise((resolve) => setTimeout(resolve, pacing.last + quietMs - Date.now()));
    pacing.count = 0;
  }
  pacing.count++;
  pacing.last = Date.now();
  writeFileSync(AUTH_PACING_FILE, JSON.stringify(pacing));
}

/** Waits for a heading. If it doesn't appear, the failure says what the page shows instead. */
export async function expectHeading(page: Page, name: string) {
  try {
    await page.getByRole("heading", { name, exact: true }).waitFor();
  } catch (err) {
    const headings = await page.getByRole("heading").allTextContents();
    const messages = await page.locator('[role="alert"], [aria-invalid="true"] ~ p').allTextContents();
    throw new Error(
      `Expected the heading "${name}" at ${page.url()}, but the page shows headings ` +
        `${JSON.stringify(headings)} and messages ${JSON.stringify(messages)}`,
      { cause: err },
    );
  }
}

export async function signUp(page: Page, name: string, email: string, password = PASSWORD) {
  await page.goto("/");
  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await paceAuthRequest();
  await page.getByRole("button", { name: "Create account" }).click();
}

export async function logIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await paceAuthRequest();
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

/** From "Your household", creates one and returns its invite code (on Household Created!). */
export async function createHousehold(page: Page, name: string): Promise<string> {
  await page.getByRole("button", { name: "Create a household" }).click();
  await page.getByLabel("Household Name").fill(name);
  await page.getByRole("button", { name: "Create a household" }).click();
  await expectHeading(page, "Household Created!");
  const code = await page.getByRole("region", { name: "Invite code" }).locator("p").nth(1).textContent();
  return code ?? "";
}

export async function logOut(page: Page) {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expectHeading(page, "Log in");
}

/** Waits for a form field to show an error, and returns the message (its accessible description). */
export async function fieldError(page: Page, label: string): Promise<string> {
  const field = page.getByLabel(label, { exact: true });
  await field.and(page.locator('[aria-invalid="true"]')).waitFor();
  const id = await field.getAttribute("aria-describedby");
  return (await page.locator(`[id="${id}"]`).textContent()) ?? "";
}
