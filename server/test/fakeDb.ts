// An in-memory stand-in for the Household and Membership tables, shared by the
// household route and service tests. It enforces the same unique rules as the
// database (invite code; one household per user) and fails the same way Prisma
// does (error code P2002). Use it in place of server/db.ts:
//
//   vi.mock("../db.js", () => import("../test/fakeDb.js"));
//   import { db } from "../test/fakeDb.js";   // to set up and inspect rows
//   beforeEach(() => db.reset());

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

/** Test users' sign-up names: "ana" → "Ana Test". */
export const nameOf = (userId: string) => `${userId[0]!.toUpperCase()}${userId.slice(1)} Test`;

const uniqueViolation = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

export const db = {
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
          .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
          .map((m) => ({ ...m, user: { name: nameOf(m.userId) } })),
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

/** Same name and shape as server/db.ts, so a vi.mock factory can return this module. */
export function getPrisma() {
  return prisma;
}
