import { afterEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "./db.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getPrisma", () => {
  it("fails with a clear message when DATABASE_URL is not set", () => {
    vi.stubEnv("DATABASE_URL", "");

    expect(() => getPrisma()).toThrow("DATABASE_URL is not set");
  });
});
