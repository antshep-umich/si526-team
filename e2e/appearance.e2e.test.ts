// Light and dark mode, and the components demo page, in a real browser.
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { expectHeading, launchBrowser, newPhone } from "./helpers.js";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser.close();
});

const computed = (page: Page, selector: string, property: string) =>
  page.locator(selector).first().evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property);

describe("light and dark mode", () => {
  it("follows the phone's light setting", async () => {
    const { context, page } = await newPhone(browser, "light");
    await page.goto("/");
    await expectHeading(page, "Log in");

    expect(await computed(page, "body", "background-image")).toContain("rgb(246, 240, 230)");
    expect(await computed(page, 'button[type="submit"]', "background-color")).toBe("rgb(168, 71, 47)");
    expect(await computed(page, 'button[type="submit"]', "color")).toBe("rgb(255, 255, 255)");
    await context.close();
  });

  it("follows the phone's dark setting", async () => {
    const { context, page } = await newPhone(browser, "dark");
    await page.goto("/");
    await expectHeading(page, "Log in");

    expect(await computed(page, "body", "background-image")).toContain("rgb(21, 21, 21)");
    expect(await computed(page, 'button[type="submit"]', "background-color")).toBe("rgb(224, 135, 106)");
    expect(await computed(page, 'button[type="submit"]', "color")).toBe("rgb(28, 22, 18)");
    await context.close();
  });

  it("loads both fonts", async () => {
    const { context, page } = await newPhone(browser);
    await page.goto("/");
    await expectHeading(page, "Log in");
    await page.evaluate(() => document.fonts.ready);

    const loaded = await page.evaluate(() =>
      [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "")),
    );
    expect(loaded).toEqual(expect.arrayContaining(["Libron", "Atkinson Hyperlegible Next"]));
    await context.close();
  });
});

describe("components demo page", () => {
  it("shows every component section", async () => {
    const { context, page } = await newPhone(browser);
    await page.goto("/components");
    await expectHeading(page, "Components");

    for (const section of [
      "Buttons · default, outline, keyboard focus",
      "Chips",
      "Overdue banner",
      "Progress",
      "Chore cards · overdue, pending, done",
      "Note",
      "Text fields · default, blocking error",
      "Avatars",
      "Tab bar",
      "Colors",
      "Type",
    ]) {
      await page.getByRole("heading", { name: section, exact: true }).waitFor();
    }
    await context.close();
  });

  it("switches between System, Light and Dark", async () => {
    const { context, page } = await newPhone(browser, "light");
    await page.goto("/components");

    await page.getByRole("radio", { name: "Dark" }).click();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
    expect(await computed(page, "body", "background-image")).toContain("rgb(21, 21, 21)");

    await page.getByRole("radio", { name: "System" }).click();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined();
    expect(await computed(page, "body", "background-image")).toContain("rgb(246, 240, 230)");
    await context.close();
  });

  it("marks chores done and selects tabs", async () => {
    const { context, page } = await newPhone(browser);
    await page.goto("/components");

    const clean = page.getByRole("checkbox", { name: "Mark Clean bathroom done" });
    await clean.click();
    expect(await page.getByRole("checkbox", { name: "Mark Clean bathroom not done" }).isChecked()).toBe(true);

    await page.getByRole("button", { name: "House", exact: true }).click();
    expect(await page.getByRole("button", { name: "House", exact: true }).getAttribute("aria-current")).toBe("page");
    await context.close();
  });
});
