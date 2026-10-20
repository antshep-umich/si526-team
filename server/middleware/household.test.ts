import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHousehold } from "../services/households.js";
import { db } from "../test/fakeModels.js";
import { handleError } from "./errors.js";
import { currentMembership, requireHousehold } from "./household.js";
import { requireUser } from "./session.js";

vi.mock("../models/households.js", () => import("../test/fakeModels.js"));
vi.mock("../models/memberships.js", () => import("../test/fakeModels.js"));

/** Signs in as the x-test-user header, then requires a household. */
function appForHouseholdRoutes() {
  const app = express();
  const signedIn = requireUser((req) => {
    const id = req.get("x-test-user");
    return id ? { id } : null;
  });
  app.get("/mine", signedIn, requireHousehold, (_req, res) => {
    res.json(currentMembership(res));
  });
  app.get("/forgot-require-household", signedIn, (_req, res) => {
    res.json(currentMembership(res));
  });
  app.use(handleError);
  return app;
}

beforeEach(() => {
  db.reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requireHousehold", () => {
  it("answers 404 NO_HOUSEHOLD for a user who hasn't joined one", async () => {
    const res = await request(appForHouseholdRoutes()).get("/mine").set("x-test-user", "ana");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "NO_HOUSEHOLD", message: "You don't belong to a household yet" },
    });
  });

  it("passes the user's own membership on to the route", async () => {
    const household = await createHousehold("ana", "Maple St House");

    const res = await request(appForHouseholdRoutes()).get("/mine").set("x-test-user", "ana");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: "ana", householdId: household.id, role: "owner" });
  });
});

describe("currentMembership", () => {
  it("fails (500) on a route that isn't behind requireHousehold", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await request(appForHouseholdRoutes()).get("/forgot-require-household").set("x-test-user", "ana");

    expect(res.status).toBe(500);
  });
});
