import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme, savedTheme, setTheme } from "./theme.ts";

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
});

describe("theme", () => {
  it("starts on the phone's setting", () => {
    expect(savedTheme()).toBe("system");
    applyTheme(savedTheme());
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });

  it("applies and remembers light or dark, and forgets it for system", () => {
    setTheme("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(savedTheme()).toBe("dark");

    setTheme("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");

    setTheme("system");
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(savedTheme()).toBe("system");
    expect(localStorage.getItem("jaals.theme")).toBeNull();
  });

  it("ignores anything else that was stored", () => {
    localStorage.setItem("jaals.theme", "purple");
    expect(savedTheme()).toBe("system");
  });

  it("still applies the choice when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    setTheme("dark");

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(savedTheme()).toBe("system");
  });
});
