import { HOUSEHOLD_NAME_MAX_LENGTH, normalizeInviteCode, parseHouseholdName } from "../../shared/api.js";
import { getPrisma } from "../db.js";
import type { Membership } from "../generated/prisma/client.js";
import { ServiceError } from "./errors.js";
import { newInviteCode } from "./inviteCode.js";

// Household rules (TECH_SPEC sections 5 and 6): one household per user, the
// creator is its owner, people join with an invite code, and only the owner can
// replace the code.

export type { Membership };

/** A household with its members, oldest first, and each member's name. */
export type HouseholdWithMembers = Awaited<ReturnType<typeof getHousehold>>;

const CODE_ATTEMPTS = 5;

/** True for Prisma's "unique constraint failed" error. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

function alreadyInHousehold(): ServiceError {
  return new ServiceError("ALREADY_IN_HOUSEHOLD", "You already belong to a household");
}

/** The user's membership, or null if they haven't joined a household. */
export function findMembership(userId: string): Promise<Membership | null> {
  return getPrisma().membership.findUnique({ where: { userId } });
}

export function getHousehold(householdId: string) {
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

/** Creates a household with `userId` as its owner. */
export async function createHousehold(userId: string, name: string): Promise<HouseholdWithMembers> {
  const cleanName = parseHouseholdName(name);
  if (!cleanName) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      `Household name must be 1 to ${HOUSEHOLD_NAME_MAX_LENGTH} characters`,
    );
  }

  const prisma = getPrisma();
  if (await findMembership(userId)) throw alreadyInHousehold();

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    try {
      // One nested write, so a household can never exist without its owner.
      const household = await prisma.household.create({
        data: {
          name: cleanName,
          inviteCode: newInviteCode(),
          memberships: { create: { userId, role: "owner" } },
        },
      });
      return await getHousehold(household.id);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Either this user joined or created a household a moment ago (two tabs),
      // or the random invite code is already taken. Only the second is worth a retry.
      if (await findMembership(userId)) throw alreadyInHousehold();
    }
  }
  throw new Error("Could not generate an unused invite code");
}

/**
 * Adds `userId` to the household with this invite code. Joining the household
 * you're already in succeeds, so a double tap is harmless.
 */
export async function joinHousehold(userId: string, inviteCode: string): Promise<HouseholdWithMembers> {
  const code = normalizeInviteCode(inviteCode);
  if (!code) throw new ServiceError("VALIDATION_ERROR", "Enter an invite code");

  const prisma = getPrisma();
  const household = await prisma.household.findUnique({ where: { inviteCode: code } });
  if (!household) throw new ServiceError("INVITE_CODE_NOT_FOUND", "No household has that invite code");

  let membership = await findMembership(userId);
  if (!membership) {
    try {
      membership = await prisma.membership.create({
        data: { userId, householdId: household.id, role: "member" },
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // The same user joined somewhere a moment ago (double tap, two tabs).
      membership = await findMembership(userId);
      if (!membership) throw err;
    }
  }
  if (membership.householdId !== household.id) throw alreadyInHousehold();
  return getHousehold(household.id);
}

/** Replaces the invite code (owner only). The old code stops working immediately. */
export async function regenerateInviteCode(membership: Membership): Promise<HouseholdWithMembers> {
  if (membership.role !== "owner") {
    throw new ServiceError("FORBIDDEN", "Only the household owner can change the invite code");
  }

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    try {
      await getPrisma().household.update({
        where: { id: membership.householdId },
        data: { inviteCode: newInviteCode() },
      });
      return await getHousehold(membership.householdId);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error("Could not generate an unused invite code");
}
