// SCRUM-75 Leave a household, and the household notices it sends (AC8), through the whole
// app with in-memory models and a fixed clock.
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { SessionResolver } from "../middleware/session.js";
import { db } from "../test/fakeModels.js";

vi.mock("../models/households.js", () => import("../test/fakeModels.js"));
vi.mock("../models/memberships.js", () => import("../test/fakeModels.js"));
vi.mock("../models/chores.js", () => import("../test/fakeModels.js"));
vi.mock("../models/notices.js", () => import("../test/fakeModels.js"));

const session: SessionResolver = (req) => {
  const id = req.get("x-test-user");
  return id ? { id } : null;
};
const app = createApp({ getSessionUser: session });
const as = (user: string) => ({
  get: (path: string) => request(app).get(path).set("x-test-user", user),
  post: (path: string, body?: object) => request(app).post(path).set("x-test-user", user).send(body),
  put: (path: string, body?: object) => request(app).put(path).set("x-test-user", user).send(body),
  patch: (path: string, body?: object) => request(app).patch(path).set("x-test-user", user).send(body),
  delete: (path: string) => request(app).delete(path).set("x-test-user", user),
});

const LEAVE = "/api/households/current/membership";
const NOTICES = "/api/households/current/notices";

/** Ana owns the household; Ben and Cleo join it. Returns its invite code. */
async function household(): Promise<string> {
  const created = await as("ana").post("/api/households", { name: "Maple St House" });
  await as("ben").post("/api/households/join", { inviteCode: created.body.inviteCode });
  await as("cleo").post("/api/households/join", { inviteCode: created.body.inviteCode });
  return created.body.inviteCode;
}

async function addChore(by: string, name: string, assigneeId: string) {
  const res = await as(by).post("/api/chores", { name, assigneeId, dueDate: "2026-10-30" });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

const choresAs = async (user: string) =>
  (await as(user).get("/api/chores?since=2026-10-26")).body.chores as { name: string; assignee: unknown; completedBy: unknown }[];
const choreNamed = async (user: string, name: string) => (await choresAs(user)).find((c) => c.name === name);

beforeEach(() => {
  db.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-29T15:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Leaving a household", { tags: ["SCRUM-75"] }, () => {
  it("AC3: Leave removes the user from the household", async () => {
    await household();

    const res = await as("ben").delete(LEAVE);

    expect(res.status).toBe(204);
    expect((await as("ben").get("/api/households/current")).body.error.code).toBe("NO_HOUSEHOLD");
    const members = (await as("ana").get("/api/households/current")).body.members.map((m: { userId: string }) => m.userId);
    expect(members).toEqual(["ana", "cleo"]);
  });

  it("AC4: the user's open chores stay on the list unassigned, and any housemate can assign them", async () => {
    await household();
    const id = await addChore("ana", "Take out trash", "ben");

    await as("ben").delete(LEAVE);

    expect(await choreNamed("ana", "Take out trash")).toMatchObject({ assignee: null });
    // Cleo neither added it nor owns the household: unassigned, it's anyone's to assign.
    const res = await as("cleo").patch(`/api/chores/${id}`, { name: "Take out trash", assigneeId: "cleo", dueDate: "2026-10-30" });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toEqual({ userId: "cleo", name: "Cleo Test" });
  });

  it("AC5: the user's completed chores stay in the household's history with their name", async () => {
    await household();
    const id = await addChore("ana", "Mop kitchen", "ben");
    await as("ben").post(`/api/chores/${id}/complete`);

    await as("ben").delete(LEAVE);

    expect(await choreNamed("ana", "Mop kitchen")).toMatchObject({
      assignee: { userId: "ben", name: "Ben Test" },
      completedBy: { userId: "ben", name: "Ben Test" },
    });
  });

  it("AC8: the remaining housemates are told \"[Name] left the household.\", and the user can't be assigned chores", async () => {
    await household();

    await as("ben").delete(LEAVE);

    for (const housemate of ["ana", "cleo"]) {
      const res = await as(housemate).get(NOTICES);
      expect(res.status).toBe(200);
      expect(res.body.notices).toEqual([
        { id: expect.any(String), kind: "member_left", personName: "Ben Test", createdAt: expect.any(String) },
      ]);
    }
    const assign = await as("ana").post("/api/chores", { name: "Sweep", assigneeId: "ben", dueDate: "2026-10-30" });
    expect(assign.body.error.code).toBe("ASSIGNEE_NOT_IN_HOUSEHOLD");
  });

  it("AC9: the last member leaving deletes the household and all of its chores", async () => {
    await as("ana").post("/api/households", { name: "Solo House" });
    await addChore("ana", "Water plants", "ana");

    expect((await as("ana").delete(LEAVE)).status).toBe(204);

    expect(db.households).toEqual([]);
    expect(db.chores).toEqual([]);
    expect((await as("ana").post("/api/households", { name: "New Place" })).status).toBe(201);
  });

  it("AC10: a former member can rejoin with an invite code, and their completed chores are still in history", async () => {
    const code = await household();
    const id = await addChore("ana", "Mop kitchen", "ben");
    await as("ben").post(`/api/chores/${id}/complete`);
    await as("ben").delete(LEAVE);

    const rejoin = await as("ben").post("/api/households/join", { inviteCode: code });

    expect(rejoin.status).toBe(201);
    expect(rejoin.body.role).toBe("member");
    const history = (await as("ben").get("/api/chores/history")).body.chores;
    expect(history).toEqual([expect.objectContaining({ name: "Mop kitchen", completedBy: { userId: "ben", name: "Ben Test" } })]);
  });
});

describe("Leaving: the team's other rules", () => {
  it("an owner who leaves isn't replaced: the household carries on without one", async () => {
    await household();

    await as("ana").delete(LEAVE);

    const res = await as("ben").get("/api/households/current");
    expect(res.body.members.map((m: { role: string }) => m.role)).toEqual(["member", "member"]);
    expect((await as("ben").post("/api/households/current/invite-code")).status).toBe(403);
  });

  it("answers 404 NO_HOUSEHOLD for someone not in a household, and 405 for other methods", async () => {
    expect((await as("zed").delete(LEAVE)).body.error.code).toBe("NO_HOUSEHOLD");

    await household();
    const res = await as("ana").get(LEAVE);
    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe("DELETE");
  });
});

describe("Household notices", () => {
  it("shows each notice once: after it's marked seen, it doesn't come back", async () => {
    await household();
    await as("ben").delete(LEAVE);
    const [notice] = (await as("ana").get(NOTICES)).body.notices;

    expect((await as("ana").put(`${NOTICES}/seen`, { through: notice.createdAt })).status).toBe(204);

    expect((await as("ana").get(NOTICES)).body.notices).toEqual([]);
    // Cleo hasn't seen it yet.
    expect((await as("cleo").get(NOTICES)).body.notices).toHaveLength(1);
  });

  it("doesn't show someone who joins later what happened before they joined", async () => {
    const code = await household();
    await as("ben").delete(LEAVE);

    await as("dev").post("/api/households/join", { inviteCode: code });

    expect((await as("dev").get(NOTICES)).body.notices).toEqual([]);
  });

  it("answers a missing or unreadable time with 422", async () => {
    await household();

    const res = await as("ana").put(`${NOTICES}/seen`, { through: "yesterday-ish" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
