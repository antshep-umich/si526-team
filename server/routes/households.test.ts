import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { SessionResolver } from "../middleware/session.js";
import { db } from "../test/fakeModels.js";

// In-memory models (server/test/fakeModels.ts) stand in for the database.
vi.mock("../models/households.js", () => import("../test/fakeModels.js"));
vi.mock("../models/memberships.js", () => import("../test/fakeModels.js"));
// Better Auth (used when the app has no test session resolver) needs a client object,
// but never queries it here: a request without a session cookie stops before that.
vi.mock("../db.js", () => ({ getPrisma: () => ({}) }));

// Tests sign in by sending an x-test-user header.
const session: SessionResolver = (req) => {
  const id = req.get("x-test-user");
  return id ? { id } : null;
};
const app = createApp({ getSessionUser: session });
const as = (user: string) => ({
  get: (path: string) => request(app).get(path).set("x-test-user", user),
  post: (path: string, body?: object) => request(app).post(path).set("x-test-user", user).send(body),
});

async function createHousehold(user: string, name = "Packard St House") {
  const res = await as(user).post("/api/households", { name });
  expect(res.status).toBe(201);
  return res.body as { id: string; inviteCode: string };
}

beforeEach(() => {
  db.reset();
});

describe("signing in", () => {
  it.each([
    ["post", "/api/households"],
    ["post", "/api/households/join"],
    ["get", "/api/households/current"],
    ["post", "/api/households/current/invite-code"],
  ] as const)("%s %s answers 401 without a session", async (method, path) => {
    const res = await request(app)[method](path);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("treats everyone as signed out when the app is built without a session resolver", async () => {
    const res = await request(createApp()).get("/api/households/current").set("x-test-user", "ana");

    expect(res.status).toBe(401);
  });
});

describe("POST /api/households", () => {
  it("creates a household with the creator as its owner", async () => {
    const res = await as("ana").post("/api/households", { name: "  Packard St House  " });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe("/api/households/current");
    expect(res.body).toMatchObject({
      name: "Packard St House",
      role: "owner",
      members: [{ userId: "ana", name: "Ana Test", role: "owner" }],
    });
    expect(res.body.inviteCode).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(db.memberships).toHaveLength(1);
  });

  it.each([
    ["missing", {}],
    ["blank", { name: "   " }],
    ["too long", { name: "x".repeat(61) }],
    ["not text", { name: 42 }],
  ])("rejects a %s name with 422", async (_label, body) => {
    const res = await as("ana").post("/api/households", body);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.households).toHaveLength(0);
  });

  it("rejects a request with no body with 422", async () => {
    const res = await as("ana").post("/api/households");

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("refuses a second household for the same user", async () => {
    await createHousehold("ana");

    const res = await as("ana").post("/api/households", { name: "Second House" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_IN_HOUSEHOLD");
    expect(db.households).toHaveLength(1);
  });

  it("tries again with a new code when the invite code is already taken", async () => {
    db.codeCollisions = 2;

    const res = await as("ana").post("/api/households", { name: "Packard St House" });

    expect(res.status).toBe(201);
    expect(db.households).toHaveLength(1);
  });

  it("gives up with a 500 if it keeps hitting taken codes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.codeCollisions = 99;

    const res = await as("ana").post("/api/households", { name: "Packard St House" });

    expect(res.status).toBe(500);
    expect(db.households).toHaveLength(0);
    vi.restoreAllMocks();
  });
});

describe("POST /api/households/join", () => {
  it("adds the user as a member: 201 with a Location header", async () => {
    const { id, inviteCode } = await createHousehold("ana");

    const res = await as("ben").post("/api/households/join", { inviteCode });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe("/api/households/current");
    expect(res.body).toMatchObject({
      id,
      role: "member",
      members: [
        { userId: "ana", name: "Ana Test", role: "owner" },
        { userId: "ben", name: "Ben Test", role: "member" },
      ],
    });
  });

  it("accepts the code in lower case with spaces or hyphens", async () => {
    const { inviteCode } = await createHousehold("ana");
    const typed = ` ${inviteCode.slice(0, 4).toLowerCase()}-${inviteCode.slice(4).toLowerCase()} `;

    const res = await as("ben").post("/api/households/join", { inviteCode: typed });

    expect(res.status).toBe(201);
  });

  it("answers 422 for a code no household has", async () => {
    await createHousehold("ana");

    const res = await as("ben").post("/api/households/join", { inviteCode: "ZZZZZZZZ" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVITE_CODE_NOT_FOUND");
    expect(db.memberships).toHaveLength(1);
  });

  it.each([
    ["missing", {}],
    ["empty", { inviteCode: " - " }],
    ["not text", { inviteCode: ["ABCDEFGH"] }],
  ])("rejects a %s code with 422", async (_label, body) => {
    const res = await as("ben").post("/api/households/join", body);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("answers 200 (not 201) without a duplicate when the user is already in that household", async () => {
    const { inviteCode } = await createHousehold("ana");
    await as("ben").post("/api/households/join", { inviteCode });

    const res = await as("ben").post("/api/households/join", { inviteCode });

    expect(res.status).toBe(200);
    expect(res.headers.location).toBeUndefined();
    expect(res.body.members).toHaveLength(2);
  });

  it("refuses a user who belongs to a different household", async () => {
    const { inviteCode } = await createHousehold("ana");
    await createHousehold("cy", "Other House");

    const res = await as("cy").post("/api/households/join", { inviteCode });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_IN_HOUSEHOLD");
    expect(db.memberships.filter((m) => m.userId === "cy")).toHaveLength(1);
  });
});

describe("GET /api/households/current", () => {
  it("answers 404 for a user with no household", async () => {
    await createHousehold("ana");

    const res = await as("ben").get("/api/households/current");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NO_HOUSEHOLD");
  });

  it("returns only the caller's own household", async () => {
    const anas = await createHousehold("ana", "Ana's House");
    const cys = await createHousehold("cy", "Cy's House");

    const res = await as("cy").get("/api/households/current");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: cys.id, name: "Cy's House" });
    expect(JSON.stringify(res.body)).not.toContain(anas.inviteCode);
    expect(JSON.stringify(res.body)).not.toContain("ana");
  });
});

describe("POST /api/households/current/invite-code", () => {
  it("lets the owner replace the code, and the old code stops working", async () => {
    const { inviteCode: oldCode } = await createHousehold("ana");

    const res = await as("ana").post("/api/households/current/invite-code");

    expect(res.status).toBe(200);
    expect(res.body.inviteCode).not.toBe(oldCode);
    expect((await as("ben").post("/api/households/join", { inviteCode: oldCode })).status).toBe(422);
    expect(
      (await as("ben").post("/api/households/join", { inviteCode: res.body.inviteCode })).status,
    ).toBe(201);
  });

  it("refuses a member who isn't the owner", async () => {
    const { inviteCode } = await createHousehold("ana");
    await as("ben").post("/api/households/join", { inviteCode });

    const res = await as("ben").post("/api/households/current/invite-code");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(db.households[0]?.inviteCode).toBe(inviteCode);
  });

  it("answers 404 for a user with no household", async () => {
    const res = await as("ben").post("/api/households/current/invite-code");

    expect(res.status).toBe(404);
  });
});

describe("HTTP details", () => {
  it.each([
    ["get", "/api/households", "POST"],
    ["get", "/api/households/join", "POST"],
    ["delete", "/api/households/current", "GET, HEAD"],
    ["get", "/api/households/current/invite-code", "POST"],
  ] as const)("answers %s %s with 405 and Allow: %s", async (method, path, allow) => {
    const res = await request(app)[method](path).set("x-test-user", "ana");

    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe(allow);
    expect(res.body.error.code).toBe("METHOD_NOT_ALLOWED");
  });

  it("answers a body that isn't JSON with 415", async () => {
    const res = await request(app)
      .post("/api/households")
      .set("x-test-user", "ana")
      .set("Content-Type", "text/plain")
      .send("name=Maple St House");

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(db.households).toHaveLength(0);
  });

  it("checks the session before the body format (401 before 415)", async () => {
    const res = await request(app).post("/api/households").set("Content-Type", "text/plain").send("x");

    expect(res.status).toBe(401);
  });
});
