// /api/chores through the whole app, with in-memory models and a fixed clock.
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { SessionResolver } from "../middleware/session.js";
import { db } from "../test/fakeModels.js";

vi.mock("../models/households.js", () => import("../test/fakeModels.js"));
vi.mock("../models/memberships.js", () => import("../test/fakeModels.js"));
vi.mock("../models/chores.js", () => import("../test/fakeModels.js"));

// Tests sign in by sending an x-test-user header.
const session: SessionResolver = (req) => {
  const id = req.get("x-test-user");
  return id ? { id } : null;
};
const app = createApp({ getSessionUser: session });
const as = (user: string) => ({
  get: (path: string) => request(app).get(path).set("x-test-user", user),
  post: (path: string, body?: object) => request(app).post(path).set("x-test-user", user).send(body),
  delete: (path: string) => request(app).delete(path).set("x-test-user", user),
});

/** Ana owns a household and Ben joins it. */
async function household() {
  const created = await as("ana").post("/api/households", { name: "Maple St House" });
  await as("ben").post("/api/households/join", { inviteCode: created.body.inviteCode });
}

const newChore = { name: "Take out trash", assigneeId: "ana", dueDate: "2026-10-30", notes: "Bins by the gate" };

beforeEach(() => {
  db.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-29T15:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/chores", () => {
  it("adds a chore: 201 with a Location header and the chore", async () => {
    await household();

    const res = await as("ben").post("/api/chores", newChore);

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/chores/${res.body.id}`);
    expect(res.body).toEqual({
      id: res.body.id,
      name: "Take out trash",
      notes: "Bins by the gate",
      dueDate: "2026-10-30",
      assignee: { userId: "ana", name: "Ana Test" },
      createdBy: { userId: "ben", name: "Ben Test" },
      createdAt: expect.any(String),
      completedAt: null,
      completedBy: null,
    });
  });

  it.each([
    ["a missing name", { ...newChore, name: "" }, "VALIDATION_ERROR"],
    ["a past due date", { ...newChore, dueDate: "2026-10-01" }, "DUE_DATE_IN_PAST"],
    ["an assignee outside the household", { ...newChore, assigneeId: "zed" }, "ASSIGNEE_NOT_IN_HOUSEHOLD"],
  ])("answers %s with 422", async (_label, body, code) => {
    await household();

    const res = await as("ben").post("/api/chores", body);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe(code);
  });

  it("answers 404 NO_HOUSEHOLD for someone without a household", async () => {
    const res = await as("zed").post("/api/chores", newChore);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NO_HOUSEHOLD");
  });

  it("answers 401 when nobody is signed in", async () => {
    expect((await request(app).post("/api/chores").send(newChore)).status).toBe(401);
  });
});

describe("GET /api/chores", () => {
  it("lists the household's chores, soonest due first", async () => {
    await household();
    await as("ben").post("/api/chores", { ...newChore, name: "Later", dueDate: "2026-11-02" });
    await as("ben").post("/api/chores", { ...newChore, name: "Sooner", dueDate: "2026-10-30" });

    const res = await as("ana").get("/api/chores?since=2026-10-26");

    expect(res.status).toBe(200);
    expect(res.body.chores.map((c: { name: string }) => c.name)).toEqual(["Sooner", "Later"]);
  });

  it("answers 422 for a since that isn't a date", async () => {
    await household();

    expect((await as("ana").get("/api/chores?since=monday")).status).toBe(422);
  });

  it("never shows another household's chores", async () => {
    await household();
    await as("ben").post("/api/chores", newChore);
    await as("cy").post("/api/households", { name: "Other House" });

    const res = await as("cy").get("/api/chores");

    expect(res.body.chores).toEqual([]);
  });
});

describe("GET /api/chores/history", () => {
  it("lists only the caller's chores, latest due first", async () => {
    await household();
    await as("ben").post("/api/chores", { ...newChore, name: "Sooner", dueDate: "2026-10-30" });
    await as("ben").post("/api/chores", { ...newChore, name: "Later", dueDate: "2026-11-02" });
    await as("ana").post("/api/chores", { ...newChore, name: "Ben's", assigneeId: "ben" });

    const res = await as("ana").get("/api/chores/history");

    expect(res.status).toBe(200);
    expect(res.body.chores.map((c: { name: string }) => c.name)).toEqual(["Later", "Sooner"]);
  });

  it("answers 405 for other methods, 404 without a household and 401 signed out", async () => {
    await household();

    expect((await as("ana").post("/api/chores/history")).status).toBe(405);
    expect((await as("zed").get("/api/chores/history")).status).toBe(404);
    expect((await request(app).get("/api/chores/history")).status).toBe(401);
  });
});

describe("GET /api/chores/:id", () => {
  it("returns one chore, or 404 for another household's", async () => {
    await household();
    const { body: added } = await as("ben").post("/api/chores", newChore);
    await as("cy").post("/api/households", { name: "Other House" });

    expect((await as("ana").get(`/api/chores/${added.id}`)).body.name).toBe("Take out trash");
    const res = await as("cy").get(`/api/chores/${added.id}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CHORE_NOT_FOUND");
  });
});


describe("GET /api/chores/:id/history (SCRUM-45)", () => {
  it("returns the chore and its history, newest first", async () => {
    await household();
    const { body: added } = await as("ben").post("/api/chores", newChore);

    // Complete the chore at a later time.
    vi.setSystemTime(new Date("2026-10-29T16:00:00Z"));
    await as("ana").post(`/api/chores/${added.id}/complete`);

    // Reopen it at an even later time.
    vi.setSystemTime(new Date("2026-10-29T17:00:00Z"));
    await as("ana").delete(`/api/chores/${added.id}/complete`);

    const res = await as("ben").get(`/api/chores/${added.id}/history`);

    expect(res.status).toBe(200);
    expect(res.body.chore.name).toBe("Take out trash");
    expect(res.body.history.map((event: { eventType: string }) => event.eventType)).toEqual([
      "reopened",
      "completed",
      "created",
    ]);

    expect(res.body.history[0].actor).toEqual({
      userId: "ana",
      name: "Ana Test",
    });
  });

  it("returns an empty history when there are no history events", async () => {
    await household();
    const { body: added } = await as("ben").post("/api/chores", newChore);

    // Remove the creation event to test an empty history.
    db.choreHistory.length = 0;

    const res = await as("ana").get(`/api/chores/${added.id}/history`);

    expect(res.status).toBe(200);
    expect(res.body.history).toEqual([]);
  });

  it("does not allow another household to view the chore history", async () => {
    await household();
    const { body: added } = await as("ben").post("/api/chores", newChore);
    await as("cy").post("/api/households", { name: "Other House" });

    const res = await as("cy").get(`/api/chores/${added.id}/history`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CHORE_NOT_FOUND");
  });

  it("returns 404 when the chore is unavailable", async () => {
    await household();

    const res = await as("ana").get(
      "/api/chores/00000000-0000-4000-9000-999999999999/history",
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CHORE_NOT_FOUND");
  });
});


describe("POST and DELETE /api/chores/:id/complete", () => {
  it("lets the assignee mark it done (200) and undo it (200)", async () => {
    await household();
    const { body: added } = await as("ben").post("/api/chores", newChore);

    const done = await as("ana").post(`/api/chores/${added.id}/complete`);
    expect(done.status).toBe(200);
    expect(done.body.completedAt).toBe("2026-10-29T15:00:00.000Z");
    expect(done.body.completedBy).toEqual({ userId: "ana", name: "Ana Test" });

    const undone = await as("ana").delete(`/api/chores/${added.id}/complete`);
    expect(undone.status).toBe(200);
    expect(undone.body.completedAt).toBeNull();
  });

  it("answers 403 NOT_ASSIGNEE for anyone else", async () => {
    await household();
    const { body: added } = await as("ben").post("/api/chores", newChore);

    const res = await as("ben").post(`/api/chores/${added.id}/complete`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("NOT_ASSIGNEE");
  });

  it("answers 404 for a chore that doesn't exist", async () => {
    await household();

    expect((await as("ana").post("/api/chores/not-a-chore/complete")).status).toBe(404);
  });
});

describe("HTTP details", () => {
  it.each([
    ["delete", "/api/chores", "GET, POST, HEAD"],
    ["patch", "/api/chores/00000000-0000-4000-9000-000000000001", "GET, HEAD"],
    ["get", "/api/chores/00000000-0000-4000-9000-000000000001/complete", "POST, DELETE"],
  ] as const)("answers %s %s with 405 and Allow: %s", async (method, path, allow) => {
    await household();

    const res = await request(app)[method](path).set("x-test-user", "ana");

    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe(allow);
  });
});

describe("acceptance criteria", () => {
  it("AC4: a chore one housemate adds appears in every housemate's list", { tags: ["SCRUM-6"] }, async () => {
    await household();

    const { body: added } = await as("ben").post("/api/chores", newChore);

    for (const user of ["ana", "ben"]) {
      const res = await as(user).get("/api/chores");
      expect(res.body.chores.map((c: { id: string }) => c.id)).toEqual([added.id]);
    }
  });

  it("AC5: only the housemate a chore is assigned to can mark it done or undo it", { tags: ["SCRUM-8"] }, async () => {
    await household();
    const { body: added } = await as("ben").post("/api/chores", newChore); // assigned to Ana
    const complete = `/api/chores/${added.id}/complete`;

    expect((await as("ben").post(complete)).status).toBe(403);
    expect((await as("ana").post(complete)).status).toBe(200);
    expect((await as("ben").delete(complete)).status).toBe(403);
    expect((await as("ana").delete(complete)).status).toBe(200);
  });

  it("AC1-AC3: housemates can view chore history with dates and newest events first", { tags: ["SCRUM-45"] }, async () => {
    await household();

    const { body: added } = await as("ben").post("/api/chores", newChore);

    vi.setSystemTime(new Date("2026-10-29T16:00:00Z"));
    await as("ana").post(`/api/chores/${added.id}/complete`);

    const res = await as("ben").get(`/api/chores/${added.id}/history`);

    expect(res.status).toBe(200);
    expect(res.body.chore.createdAt).toBeDefined();
    expect(res.body.chore.dueDate).toBe("2026-10-30");
    expect(res.body.history.map((event: { eventType: string }) => event.eventType)).toEqual([
      "completed",
      "created",
    ]);
  });
});
