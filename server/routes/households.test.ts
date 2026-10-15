import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { SessionResolver } from "../session.js";

// An in-memory stand-in for the two tables these routes use. It enforces the same
// unique rules as the database (invite code; one household per user) and fails
// the same way Prisma does (error code P2002).
const { db, getPrisma } = vi.hoisted(() => {
  interface HouseholdRow {
    id: string;
    name: string;
    inviteCode: string;
    createdAt: Date;
  }
  interface MembershipRow {
    userId: string;
    householdId: string;
    role: "owner" | "member";
    joinedAt: Date;
  }
  const uniqueViolation = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

  const db = {
    households: [] as HouseholdRow[],
    memberships: [] as MembershipRow[],
    clock: 0,
    /** Makes the next N household writes fail as if the invite code were taken. */
    codeCollisions: 0,
    reset() {
      db.households = [];
      db.memberships = [];
      db.clock = 0;
      db.codeCollisions = 0;
    },
    now: () => new Date(Date.UTC(2026, 9, 8, 12, 0, db.clock++)),
    addMembership(userId: string, householdId: string, role: "owner" | "member") {
      if (db.memberships.some((m) => m.userId === userId)) throw uniqueViolation();
      const row = { userId, householdId, role, joinedAt: db.now() };
      db.memberships.push(row);
      return row;
    },
    checkCode(inviteCode: string, exceptId?: string) {
      if (db.codeCollisions > 0) {
        db.codeCollisions--;
        throw uniqueViolation();
      }
      if (db.households.some((h) => h.inviteCode === inviteCode && h.id !== exceptId)) {
        throw uniqueViolation();
      }
    },
  };

  const prisma = {
    membership: {
      findUnique: async ({ where }: { where: { userId: string } }) =>
        db.memberships.find((m) => m.userId === where.userId) ?? null,
      create: async ({ data }: { data: Omit<MembershipRow, "joinedAt"> }) =>
        db.addMembership(data.userId, data.householdId, data.role),
    },
    household: {
      create: async ({
        data,
      }: {
        data: {
          name: string;
          inviteCode: string;
          memberships: { create: { userId: string; role: "owner" | "member" } };
        };
      }) => {
        const owner = data.memberships.create;
        if (db.memberships.some((m) => m.userId === owner.userId)) throw uniqueViolation();
        db.checkCode(data.inviteCode);
        const row = {
          id: `00000000-0000-4000-8000-${String(db.households.length + 1).padStart(12, "0")}`,
          name: data.name,
          inviteCode: data.inviteCode,
          createdAt: db.now(),
        };
        db.households.push(row);
        db.addMembership(owner.userId, row.id, owner.role);
        return row;
      },
      findUnique: async ({ where }: { where: { inviteCode: string } }) =>
        db.households.find((h) => h.inviteCode === where.inviteCode) ?? null,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const row = db.households.find((h) => h.id === where.id);
        if (!row) throw new Error("No Household found");
        return {
          ...row,
          memberships: db.memberships
            .filter((m) => m.householdId === row.id)
            .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime()),
        };
      },
      update: async ({ where, data }: { where: { id: string }; data: { inviteCode: string } }) => {
        const row = db.households.find((h) => h.id === where.id);
        if (!row) throw new Error("No Household found");
        db.checkCode(data.inviteCode, row.id);
        row.inviteCode = data.inviteCode;
        return row;
      },
    },
  };
  return { db, getPrisma: vi.fn(() => prisma) };
});
vi.mock("../db.js", () => ({ getPrisma }));

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
    expect(res.body).toMatchObject({
      name: "Packard St House",
      role: "owner",
      members: [{ userId: "ana", role: "owner" }],
    });
    expect(res.body.inviteCode).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(db.memberships).toHaveLength(1);
  });

  it.each([
    ["missing", {}],
    ["blank", { name: "   " }],
    ["too long", { name: "x".repeat(61) }],
    ["not text", { name: 42 }],
  ])("rejects a %s name", async (_label, body) => {
    const res = await as("ana").post("/api/households", body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.households).toHaveLength(0);
  });

  it("rejects a request with no body", async () => {
    const res = await as("ana").post("/api/households");

    expect(res.status).toBe(400);
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
  it("adds the user as a member", async () => {
    const { id, inviteCode } = await createHousehold("ana");

    const res = await as("ben").post("/api/households/join", { inviteCode });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      role: "member",
      members: [
        { userId: "ana", role: "owner" },
        { userId: "ben", role: "member" },
      ],
    });
  });

  it("accepts the code in lower case with spaces or hyphens", async () => {
    const { inviteCode } = await createHousehold("ana");
    const typed = ` ${inviteCode.slice(0, 4).toLowerCase()}-${inviteCode.slice(4).toLowerCase()} `;

    const res = await as("ben").post("/api/households/join", { inviteCode: typed });

    expect(res.status).toBe(200);
  });

  it("answers 404 for a code no household has", async () => {
    await createHousehold("ana");

    const res = await as("ben").post("/api/households/join", { inviteCode: "ZZZZZZZZ" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("INVITE_CODE_NOT_FOUND");
    expect(db.memberships).toHaveLength(1);
  });

  it.each([
    ["missing", {}],
    ["empty", { inviteCode: " - " }],
    ["not text", { inviteCode: ["ABCDEFGH"] }],
  ])("rejects a %s code", async (_label, body) => {
    const res = await as("ben").post("/api/households/join", body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("succeeds without a duplicate when the user is already in that household", async () => {
    const { inviteCode } = await createHousehold("ana");
    await as("ben").post("/api/households/join", { inviteCode });

    const res = await as("ben").post("/api/households/join", { inviteCode });

    expect(res.status).toBe(200);
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
    expect((await as("ben").post("/api/households/join", { inviteCode: oldCode })).status).toBe(404);
    expect(
      (await as("ben").post("/api/households/join", { inviteCode: res.body.inviteCode })).status,
    ).toBe(200);
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
