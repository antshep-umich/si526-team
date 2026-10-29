import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";

// A stand-in for Better Auth's internal context: one account, ana@example.com.
const { ctx } = vi.hoisted(() => {
  const ctx = {
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
  };
  return { ctx };
});
vi.mock("../auth.js", () => ({
  getAuth: () => ({ $context: Promise.resolve(ctx) }),
  authHandler: (_req: unknown, res: { status: (n: number) => { end: () => void } }) => res.status(404).end(),
  betterAuthSession: () => null,
}));

const app = createApp();
const reset = (body: object) => request(app).post("/api/password-reset").send(body);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/password-reset", () => {
  it("sets the new password (hashed) and signs the account out everywhere", async () => {
    const res = await reset({ email: "  Ana@Example.com ", newPassword: "new-password-1" });

    expect(res.status).toBe(204);
    expect(ctx.internalAdapter.updatePassword).toHaveBeenCalledWith("user-ana", "hashed:new-password-1");
    expect(ctx.internalAdapter.deleteUserSessions).toHaveBeenCalledWith("user-ana");
  });

  it("answers 422 for an email with no account", async () => {
    const res = await reset({ email: "nobody@example.com", newPassword: "new-password-1" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ACCOUNT_NOT_FOUND");
    expect(ctx.internalAdapter.updatePassword).not.toHaveBeenCalled();
  });

  it.each([
    ["too short", "short1"],
    ["too long", "x1".repeat(65)],
    ["without a number", "no-numbers-here"],
    ["missing", undefined],
  ])("rejects a password that is %s with 422", async (_label, newPassword) => {
    const res = await reset({ email: "ana@example.com", newPassword });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PASSWORD_INVALID");
    expect(ctx.internalAdapter.updatePassword).not.toHaveBeenCalled();
  });

  it("asks for an email when there is none (422)", async () => {
    const res = await reset({ newPassword: "new-password-1" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/password-reset HTTP details", () => {
  it("answers other methods with 405 and Allow: POST", async () => {
    const res = await request(app).get("/api/password-reset");

    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe("POST");
  });

  it("answers a form-encoded body with 415", async () => {
    const res = await request(app)
      .post("/api/password-reset")
      .type("form")
      .send({ email: "ana@example.com", newPassword: "new-password-1" });

    expect(res.status).toBe(415);
    expect(ctx.internalAdapter.updatePassword).not.toHaveBeenCalled();
  });
});
