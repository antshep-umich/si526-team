import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleError } from "./errors.js";
import { currentUser, requireUser, type SessionResolver } from "./session.js";

/** An app with a protected route that echoes the signed-in user, and one that forgot requireUser. */
function appWith(resolve: SessionResolver) {
  const app = express();
  app.get("/me", requireUser(resolve), (_req, res) => {
    res.json(currentUser(res));
  });
  app.get("/forgot-require-user", (_req, res) => {
    res.json(currentUser(res));
  });
  app.use(handleError);
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requireUser", () => {
  it("answers 401 UNAUTHENTICATED when nobody is signed in", async () => {
    const res = await request(appWith(() => null)).get("/me");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue" } });
  });

  it("passes the signed-in user on to the route", async () => {
    const res = await request(appWith(async () => ({ id: "ana" }))).get("/me");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: "ana" });
  });
});

describe("currentUser", () => {
  it("fails (500) on a route that isn't behind requireUser, instead of acting as nobody", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await request(appWith(() => ({ id: "ana" }))).get("/forgot-require-user");

    expect(res.status).toBe(500);
    expect(console.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: "currentUser called on a route without requireUser" }),
    );
  });
});
