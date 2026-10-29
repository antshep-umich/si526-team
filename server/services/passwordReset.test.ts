import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "./errors.js";
import { resetPassword } from "./passwordReset.js";

// The accounts model, faked: one account, ana@example.com, with Better Auth's default limits.
const accounts = vi.hoisted(() => ({
  passwordLengthLimits: vi.fn(async () => ({ min: 8, max: 128 })),
  findPasswordAccountByEmail: vi.fn(async (email: string) => (email === "ana@example.com" ? { userId: "user-ana" } : null)),
  setPassword: vi.fn(async () => {}),
  deleteAllSessions: vi.fn(async () => {}),
}));
vi.mock("../models/accounts.js", () => accounts);

beforeEach(() => {
  vi.clearAllMocks();
});

async function codeOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof ServiceError) return err.code;
    throw err;
  }
  throw new Error("Expected a ServiceError");
}

describe("resetPassword", () => {
  it("looks the account up by trimmed, lower-case email and sets the new password", async () => {
    await resetPassword("  Ana@Example.COM ", "new-password-1");

    expect(accounts.findPasswordAccountByEmail).toHaveBeenCalledWith("ana@example.com");
    expect(accounts.setPassword).toHaveBeenCalledWith("user-ana", "new-password-1");
  });

  it("signs the account out everywhere, after changing the password", async () => {
    await resetPassword("ana@example.com", "new-password-1");

    expect(accounts.deleteAllSessions).toHaveBeenCalledWith("user-ana");
    expect(accounts.setPassword.mock.invocationCallOrder[0]).toBeLessThan(
      accounts.deleteAllSessions.mock.invocationCallOrder[0]!,
    );
  });

  it("asks for an email before anything else", async () => {
    expect(await codeOf(() => resetPassword("   ", "short"))).toBe("VALIDATION_ERROR");
    expect(accounts.passwordLengthLimits).not.toHaveBeenCalled();
  });

  it.each([
    ["7 characters", "abcdef1"],
    ["129 characters", "1" + "x".repeat(128)],
    ["no number", "no-numbers-here"],
  ])("rejects a password with %s (SCRUM-2 rules)", async (_label, password) => {
    expect(await codeOf(() => resetPassword("ana@example.com", password))).toBe("PASSWORD_INVALID");
    expect(accounts.setPassword).not.toHaveBeenCalled();
  });

  it("accepts passwords of exactly the minimum and maximum length", async () => {
    await resetPassword("ana@example.com", "abcdefg1");
    await resetPassword("ana@example.com", "1" + "x".repeat(127));

    expect(accounts.setPassword).toHaveBeenCalledTimes(2);
  });

  it("reports an email with no password account, and changes nothing", async () => {
    expect(await codeOf(() => resetPassword("nobody@example.com", "new-password-1"))).toBe("ACCOUNT_NOT_FOUND");
    expect(accounts.setPassword).not.toHaveBeenCalled();
    expect(accounts.deleteAllSessions).not.toHaveBeenCalled();
  });
});
