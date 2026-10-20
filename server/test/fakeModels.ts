// In-memory stand-ins for the household and membership models, for tests that
// shouldn't need a database. Each function is typed as the real model function,
// so the fake can't drift from the real API. It enforces the same unique rules
// as the database (invite code; one membership per user) and fails the same way
// the models do (UniqueConflictError). Use it in place of the models:
//
//   vi.mock("../models/households.js", () => import("../test/fakeModels.js"));
//   vi.mock("../models/memberships.js", () => import("../test/fakeModels.js"));
//   import { db } from "../test/fakeModels.js";   // to set up and inspect rows
//   beforeEach(() => db.reset());
//
// The real models' Prisma queries are covered by models/*.test.ts and the e2e tests.
import { UniqueConflictError } from "../models/errors.js";
import type * as householdsModel from "../models/households.js";
import type { Household } from "../models/households.js";
import type * as membershipsModel from "../models/memberships.js";
import type { Membership, MembershipRole } from "../models/memberships.js";

/** Test users' sign-up names: "ana" → "Ana Test". */
export const nameOf = (userId: string) => `${userId[0]!.toUpperCase()}${userId.slice(1)} Test`;

export const db = {
  households: [] as Household[],
  memberships: [] as Membership[],
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
