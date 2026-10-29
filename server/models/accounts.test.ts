import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAllSessions, findPasswordAccountByEmail, passwordLengthLimits, setPassword } from "./accounts.js";

// A stand-in for Better Auth's internal context with one password account, ana@example.com.
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

describe("accounts model", () => {
  it("reports Better Auth's password length limits", async () => {
    expect(await passwordLengthLimits()).toEqual({ min: 8, max: 128 });
  });

  it("finds a user who signs in with a password", async () => {
    expect(await findPasswordAccountByEmail("ana@example.com")).toEqual({ userId: "user-ana" });
  });

  it("returns null for an unknown email, or a user without a password account", async () => {
    expect(await findPasswordAccountByEmail("nobody@example.com")).toBeNull();

    ctx.internalAdapter.findCredentialAccount.mockResolvedValueOnce(null);
    expect(await findPasswordAccountByEmail("ana@example.com")).toBeNull();
  });

  it("stores passwords hashed by Better Auth, never as typed", async () => {
    await setPassword("user-ana", "new-password-1");

    expect(ctx.password.hash).toHaveBeenCalledWith("new-password-1");
    expect(ctx.internalAdapter.updatePassword).toHaveBeenCalledWith("user-ana", "hashed:new-password-1");
  });

  it("deletes all of a user's sessions", async () => {
    await deleteAllSessions("user-ana");

    expect(ctx.internalAdapter.deleteUserSessions).toHaveBeenCalledWith("user-ana");
  });
});
