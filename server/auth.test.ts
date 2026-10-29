import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { signUpRuleError } from "./auth.js";

// These requests never reach the database, so a stand-in client is enough.
vi.mock("./db.js", () => ({ getPrisma: () => ({}) }));

describe("Better Auth wiring", () => {
  it("serves Better Auth's routes under /api/auth", async () => {
    const res = await request(createApp()).get("/api/auth/ok");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("answers protected routes with 401 when there is no session cookie", async () => {
    const res = await request(createApp()).get("/api/households/current");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("sign-up rules (SCRUM-2)", () => {
  it.each([
    ["an empty name", { name: "  ", password: "password1" }, "NAME_INVALID"],
    ["a 31-character name", { name: "x".repeat(31), password: "password1" }, "NAME_INVALID"],
    ["a 7-character password", { name: "Ana", password: "passwo1" }, "PASSWORD_INVALID"],
    ["a password without a number", { name: "Ana", password: "password" }, "PASSWORD_INVALID"],
    ["no body", undefined, "NAME_INVALID"],
  ])("rejects %s", (_label, body, code) => {
    expect(signUpRuleError(body)?.code).toBe(code);
  });

  it("accepts a 30-character name and an 8-character password with a number", () => {
    expect(signUpRuleError({ name: "x".repeat(30), password: "passwor1" })).toBeNull();
  });

  it("stops a sign-up that breaks them before Better Auth creates anything", async () => {
    const res = await request(createApp())
      .post("/api/auth/sign-up/email")
      .set("Origin", "http://localhost:5173")
      .send({ name: "Ana", email: "ana@example.com", password: "password" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      code: "PASSWORD_INVALID",
      message: "Password must be at least 8 characters long and include 1 number.",
    });
  });
});
