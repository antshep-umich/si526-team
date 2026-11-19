import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { SessionResolver } from "../middleware/session.js";
import { db } from "../test/fakeModels.js";

// SCRUM-61 preferred chores: /api/households/current/preferred-chores.
vi.mock("../models/households.js", () => import("../test/fakeModels.js"));
vi.mock("../models/memberships.js", () => import("../test/fakeModels.js"));
vi.mock("../models/chores.js", () => import("../test/fakeModels.js"));
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

const PATH = "/api/households/current/preferred-chores";
let householdId = "";

/** Adds a chore row straight to the fake table. */
function addChore(name: string) {
  const now = db.now();
  db.chores.push({
    id: `c${db.chores.length + 1}`,
    householdId,
    name,
    notes: null,
    assigneeId: "ana",
    dueDate: now,
    completedAt: null,
    completedById: null,
    createdById: "ana",
    createdAt: now,
    updatedAt: now,
  });
}

beforeEach(async () => {
  db.reset();
  const created = await request(app).post("/api/households").set("x-test-user", "ana").send({ name: "Maple St House" });
  householdId = created.body.id;
  await request(app).post("/api/households/join").set("x-test-user", "ben").send({ inviteCode: created.body.inviteCode });
});

describe("preferred chores", { tags: ["SCRUM-61"] }, () => {
  it("AC1: lists the household's chores once each, A to Z, none preferred at first", async () => {
    addChore("Vacuum living room");
    addChore("take out trash");
    addChore("  Take out   trash ");

    const res = await as("ben").get(PATH);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      chores: [
        { name: "Take out   trash", preferred: false },
        { name: "Vacuum living room", preferred: false },
      ],
    });
  });

  it("AC2: saves the marked chores and they stay marked", async () => {
    addChore("Take out trash");
    addChore("Vacuum living room");

    const saved = await as("ben").put(PATH, { names: ["take out TRASH"] });

    expect(saved.status).toBe(200);
    expect(saved.body.chores).toEqual([
      { name: "Take out trash", preferred: true },
      { name: "Vacuum living room", preferred: false },
    ]);
    expect((await as("ben").get(PATH)).body).toEqual(saved.body);
    // Unmarking: save without it.
    expect((await as("ben").put(PATH, { names: [] })).body.chores[0].preferred).toBe(false);
  });

  it("AC3: housemates see who prefers a chore in the household's members", async () => {
    addChore("Take out trash");
    await as("ben").put(PATH, { names: ["Take out trash"] });

    const res = await as("ana").get("/api/households/current");
    const ben = res.body.members.find((m: { userId: string }) => m.userId === "ben");

    expect(ben.preferredChores).toEqual(["take out trash"]);
  });

  it("AC4: a household with no chores yet has nothing to choose from", async () => {
    expect((await as("ben").get(PATH)).body).toEqual({ chores: [] });
  });

  it.each([
    ["a chore the household doesn't have", { names: ["Walk the dog"] }],
    ["no names list", {}],
    ["a blank name", { names: [" "] }],
  ])("rejects %s with 422", async (_label, body) => {
    addChore("Take out trash");

    const res = await as("ben").put(PATH, body);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
