import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "./errors.js";
import { resetPassword } from "./passwordReset.js";

// A stand-in for Better Auth's internal context with one account, ana@example.com.
const { ctx } = vi.hoisted(() => ({
  ctx: {
    password: {
      config: { minPasswordLength: 8, maxPasswordLength: 128 },
      hash: vi.fn(async (pw: string) => `hashed:${pw}`),
    },
    internalAdapter: {
      findUserByEmail: vi.fn(async (email: string) =>
        email === "ana@example.com" ? { user: { id: "user-ana" }, accounts: [] } : null,
      ),
      findCredentialAccount: vi.fn(async (userId: string) =>
        userId === "user-ana" ? { id: "acct-ana", providerId: "credential" } : null,
      ),
      updatePassword: vi.fn(async () => {}),
      deleteUserSessions: vi.fn(async () => {}),
    },
  },
}));
vi.mock("../auth.js", () => ({ getAuth: () => ({ $context: Promise.resolve(ctx) }) }));

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
  it("looks the account up by trimmed, lower-case email and stores the hashed password", async () => {
    await resetPassword("  Ana@Example.COM ", "new-password-1");

    expect(ctx.internalAdapter.findUserByEmail).toHaveBeenCalledWith("ana@example.com");
    expect(ctx.internalAdapter.updatePassword).toHaveBeenCalledWith("user-ana", "hashed:new-password-1");
  });

  it("signs the account out everywhere", async () => {
    await resetPassword("ana@example.com", "new-password-1");

    expect(ctx.internalAdapter.deleteUserSessions).toHaveBeenCalledWith("user-ana");
  });

  it("asks for an email before anything else", async () => {
    expect(await codeOf(() => resetPassword("   ", "short"))).toBe("VALIDATION_ERROR");
  });

  it.each([7, 129])("rejects a %i-character password using Better Auth's limits", async (length) => {
    expect(await codeOf(() => resetPassword("ana@example.com", "x".repeat(length)))).toBe("PASSWORD_LENGTH");
    expect(ctx.internalAdapter.updatePassword).not.toHaveBeenCalled();
  });

  it("accepts passwords of exactly 8 and 128 characters", async () => {
    await resetPassword("ana@example.com", "x".repeat(8));
    await resetPassword("ana@example.com", "x".repeat(128));

    expect(ctx.internalAdapter.updatePassword).toHaveBeenCalledTimes(2);
  });

  it("reports an email with no account", async () => {
    expect(await codeOf(() => resetPassword("nobody@example.com", "new-password-1"))).toBe("ACCOUNT_NOT_FOUND");
  });

  it("reports an account with no password (for example, one that only signs in with Google)", async () => {
    ctx.internalAdapter.findCredentialAccount.mockResolvedValueOnce(null);

    expect(await codeOf(() => resetPassword("ana@example.com", "new-password-1"))).toBe("ACCOUNT_NOT_FOUND");
    expect(ctx.internalAdapter.updatePassword).not.toHaveBeenCalled();
  });
});
