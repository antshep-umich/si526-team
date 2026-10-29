// In-memory stand-ins for the household, membership and chore models, for tests that
// shouldn't need a database. Each function is typed as the real model function,
// so the fake can't drift from the real API. It enforces the same unique rules
// as the database (invite code; one membership per user) and fails the same way
// the models do (UniqueConflictError). Use it in place of the models:
//
//   vi.mock("../models/households.js", () => import("../test/fakeModels.js"));
//   vi.mock("../models/memberships.js", () => import("../test/fakeModels.js"));
//   vi.mock("../models/chores.js", () => import("../test/fakeModels.js"));
//   import { db } from "../test/fakeModels.js";   // to set up and inspect rows
//   beforeEach(() => db.reset());
//
// The real models' Prisma queries are covered by models/*.test.ts and the e2e tests.
import { UniqueConflictError } from "../models/errors.js";
import type * as householdsModel from "../models/households.js";
import type { Household } from "../models/households.js";
import type * as membershipsModel from "../models/memberships.js";
import type { Membership, MembershipRole } from "../models/memberships.js";
import type * as choresModel from "../models/chores.js";

/** A Chore row as the database stores it. */
interface ChoreRow {
  id: string;
  householdId: string;
  name: string;
  notes: string | null;
  assigneeId: string | null;
  dueDate: Date;
  completedAt: Date | null;
  completedById: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Test users' sign-up names: "ana" → "Ana Test". */
export const nameOf = (userId: string) => `${userId[0]!.toUpperCase()}${userId.slice(1)} Test`;

export const db = {
  households: [] as Household[],
  memberships: [] as Membership[],
  chores: [] as ChoreRow[],
  clock: 0,
  /** Makes the next N household writes fail as if the invite code were taken. */
  codeCollisions: 0,
  reset() {
    db.households = [];
    db.memberships = [];
    db.chores = [];
    db.clock = 0;
    db.codeCollisions = 0;
  },
  now: () => new Date(Date.UTC(2026, 9, 8, 12, 0, db.clock++)),
  addMembership(userId: string, householdId: string, role: MembershipRole): Membership {
    if (db.memberships.some((m) => m.userId === userId)) throw new UniqueConflictError();
    const row = { userId, householdId, role, joinedAt: db.now() };
    db.memberships.push(row);
    return row;
  },
  checkCode(inviteCode: string, exceptId?: string) {
    if (db.codeCollisions > 0) {
      db.codeCollisions--;
      throw new UniqueConflictError();
    }
    if (db.households.some((h) => h.inviteCode === inviteCode && h.id !== exceptId)) {
      throw new UniqueConflictError();
    }
  },
};

// models/memberships.ts

export const findMembershipByUser: typeof membershipsModel.findMembershipByUser = async (userId) =>
  db.memberships.find((m) => m.userId === userId) ?? null;

export const createMembership: typeof membershipsModel.createMembership = async ({ userId, householdId, role }) =>
  db.addMembership(userId, householdId, role);

// models/households.ts

export const findHouseholdWithMembers: typeof householdsModel.findHouseholdWithMembers = (async (
  householdId: string,
) => {
  const row = db.households.find((h) => h.id === householdId);
  if (!row) throw new Error("No Household found");
  return {
    ...row,
    memberships: db.memberships
      .filter((m) => m.householdId === row.id)
      .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
      .map((m) => ({ ...m, user: { name: nameOf(m.userId) } })),
  };
}) as typeof householdsModel.findHouseholdWithMembers;

export const findHouseholdByInviteCode: typeof householdsModel.findHouseholdByInviteCode = async (inviteCode) =>
  db.households.find((h) => h.inviteCode === inviteCode) ?? null;

export const createHouseholdWithOwner: typeof householdsModel.createHouseholdWithOwner = async ({
  name,
  inviteCode,
  ownerId,
}) => {
  if (db.memberships.some((m) => m.userId === ownerId)) throw new UniqueConflictError();
  db.checkCode(inviteCode);
  const row = {
    id: `00000000-0000-4000-8000-${String(db.households.length + 1).padStart(12, "0")}`,
    name,
    inviteCode,
    createdAt: db.now(),
  };
  db.households.push(row);
  db.addMembership(ownerId, row.id, "owner");
  return row;
};

export const setInviteCode: typeof householdsModel.setInviteCode = async (householdId, inviteCode) => {
  const row = db.households.find((h) => h.id === householdId);
  if (!row) throw new Error("No Household found");
  db.checkCode(inviteCode, row.id);
  row.inviteCode = inviteCode;
  return row;
};

export const checkHouseholdTable: typeof householdsModel.checkHouseholdTable = async () => {};

// models/chores.ts

const person = (userId: string | null) => (userId ? { id: userId, name: nameOf(userId) } : null);

/** A chore row with its people, as the real model returns it. */
function withPeople(row: ChoreRow): choresModel.ChoreWithPeople {
  return {
    ...row,
    assignee: person(row.assigneeId),
    createdBy: person(row.createdById),
    completedBy: person(row.completedById),
  };
}

export const findChoresForHousehold: typeof choresModel.findChoresForHousehold = async (householdId, since) =>
  db.chores
    .filter(
      (c) =>
        c.householdId === householdId &&
        (c.completedAt === null || c.completedAt >= since || c.dueDate >= since),
    )
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.createdAt.getTime() - b.createdAt.getTime())
    .map(withPeople);

export const findChoreInHousehold: typeof choresModel.findChoreInHousehold = async (householdId, choreId) => {
  const row = db.chores.find((c) => c.id === choreId && c.householdId === householdId);
  return row ? withPeople(row) : null;
};

export const createChore: typeof choresModel.createChore = async (data) => {
  const now = db.now();
  const row: ChoreRow = {
    id: `00000000-0000-4000-9000-${String(db.chores.length + 1).padStart(12, "0")}`,
    ...data,
    completedAt: null,
    completedById: null,
    createdAt: now,
    updatedAt: now,
  };
  db.chores.push(row);
  return withPeople(row);
};

export const setChoreCompletion: typeof choresModel.setChoreCompletion = async (choreId, completion) => {
  const row = db.chores.find((c) => c.id === choreId);
  if (!row) throw new Error("No Chore found");
  Object.assign(row, completion, { updatedAt: db.now() });
  return withPeople(row);
};
