import { getPrisma } from "../db.js";
import type { Household } from "../generated/prisma/client.js";
import { translateUniqueConflict } from "./errors.js";

// The Household table. inviteCode is unique.

export type { Household };

/** A household with its members, oldest first, and each member's name. */
export type HouseholdWithMembers = Awaited<ReturnType<typeof findHouseholdWithMembers>>;

export function findHouseholdWithMembers(householdId: string) {
  return getPrisma().household.findUniqueOrThrow({
    where: { id: householdId },
    include: {
      memberships: {
        orderBy: { joinedAt: "asc" },
        include: { user: { select: { name: true } } },
      },
    },
  });
}

export function findHouseholdByInviteCode(inviteCode: string): Promise<Household | null> {
  return getPrisma().household.findUnique({ where: { inviteCode } });
}

/**
 * Creates a household and its owner's membership in one write, so a household
 * can never exist without its owner. Throws UniqueConflictError if the invite
 * code is taken or the owner already has a membership.
 */
export function createHouseholdWithOwner(data: { name: string; inviteCode: string; ownerId: string }): Promise<Household> {
  return translateUniqueConflict(() =>
    getPrisma().household.create({
      data: {
        name: data.name,
        inviteCode: data.inviteCode,
        memberships: { create: { userId: data.ownerId, role: "owner" } },
      },
    }),
  );
}

/** Replaces the invite code. Throws UniqueConflictError if the new code is taken. */
export function setInviteCode(householdId: string, inviteCode: string): Promise<Household> {
  return translateUniqueConflict(() =>
    getPrisma().household.update({ where: { id: householdId }, data: { inviteCode } }),
  );
}

/**
 * Reads the Household table, so it throws if the database is unreachable, isn't
 * configured, or migrations haven't run. Used by the health check.
 */
export async function checkHouseholdTable(): Promise<void> {
  await getPrisma().household.findFirst({ select: { id: true } });
}
