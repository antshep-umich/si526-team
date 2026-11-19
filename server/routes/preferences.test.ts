import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { SessionResolver } from "../middleware/session.js";
import { db } from "../test/fakeModels.js";

// SCRUM-72 profile preferences: /api/households/current/preferences and /assignment-method.
vi.mock("../models/households.js", () => import("../test/fakeModels.js"));
vi.mock("../models/memberships.js", () => import("../test/fakeModels.js"));
vi.mock("../db.js", () => ({ getPrisma: () => ({}) }));

const session: SessionResolver = (req) => {
  const id = req.get("x-test-user");
  return id ? { id } : null;
};
const app = createApp({ getSessionUser: session });
const as = (user: string) => ({
  get: (path: string) => request(app).get(path).set("x-test-user", user),
  put: (path: string, body?: object) => request(app).put(path).set("x-test-user", user).send(body),
});

const PREFERENCES = "/api/households/current/preferences";
const METHOD = "/api/households/current/assignment-method";

/** Ana owns Maple St House; Ben is a member. */
async function setUp() {
  const created = await request(app)
    .post("/api/households")
    .set("x-test-user", "ana")
    .send({ name: "Maple St House" });
  await request(app).post("/api/households/join").set("x-test-user", "ben").send({ inviteCode: created.body.inviteCode });
}

beforeEach(async () => {
  db.reset();
  await setUp();
});

describe("chore preferences", { tags: ["SCRUM-72"] }, () => {
  it("AC6: starts with no preferences chosen", async () => {
    const res = await as("ben").get(PREFERENCES);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ choreTypes: [], weeklyWorkload: null });
  });

  it("AC10: saves the selected preferences, and they are there next time", async () => {
    const saved = await as("ben").put(PREFERENCES, {
      choreTypes: ["laundry", "dishes", "laundry"],
      weeklyWorkload: "medium",
    });

    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({ choreTypes: ["dishes", "laundry"], weeklyWorkload: "medium" });
    expect((await as("ben").get(PREFERENCES)).body).toEqual(saved.body);
    // Each member's preferences are their own.
    expect((await as("ana").get(PREFERENCES)).body).toEqual({ choreTypes: [], weeklyWorkload: null });
  });

  it.each([
    ["an unknown chore type", { choreTypes: ["juggling"], weeklyWorkload: null }],
    ["an unknown workload", { choreTypes: [], weeklyWorkload: "extreme" }],
    ["no chore types", { weeklyWorkload: "light" }],
  ])("rejects %s with 422", async (_label, body) => {
    const res = await as("ben").put(PREFERENCES, body);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("answers 404 for someone without a household", async () => {
    expect((await as("cal").get(PREFERENCES)).status).toBe(404);
  });
});

describe("household manager preferences", { tags: ["SCRUM-72"] }, () => {
  it("AC11: the household shows its assignment method, none at first", async () => {
    const res = await as("ben").get("/api/households/current");

    expect(res.body.assignmentMethod).toBeNull();
  });

  it("AC12: the owner saves how chores are assigned", async () => {
    const res = await as("ana").put(METHOD, { assignmentMethod: "preferences" });

    expect(res.status).toBe(200);
    expect(res.body.assignmentMethod).toBe("preferences");
    expect((await as("ben").get("/api/households/current")).body.assignmentMethod).toBe("preferences");
  });

  it("answers 403 when a member who isn't the owner tries", async () => {
    const res = await as("ben").put(METHOD, { assignmentMethod: "rotate" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects an unknown method with 422", async () => {
    const res = await as("ana").put(METHOD, { assignmentMethod: "coin-flip" });

    expect(res.status).toBe(422);
  });

  it("answers 405 for other methods", async () => {
    const res = await request(app).post(METHOD).set("x-test-user", "ana").send({});

    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe("PUT");
  });
});
