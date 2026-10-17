import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";

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
