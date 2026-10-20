import { HOUSEHOLD_NAME_MAX_LENGTH, normalizeInviteCode, parseHouseholdName } from "../../shared/api.js";
import { UniqueConflictError } from "../models/errors.js";
import {
  createHouseholdWithOwner,
  findHouseholdByInviteCode,
  findHouseholdWithMembers,
  setInviteCode,
  type HouseholdWithMembers,
} from "../models/households.js";
import { createMembership, findMembershipByUser, type Membership } from "../models/memberships.js";
import { ServiceError } from "./errors.js";
import { newInviteCode } from "./inviteCode.js";

// Household rules (TECH_SPEC sections 5 and 6): one household per user, the
// creator is its owner, people join with an invite code, and only the owner can
// replace the code.

export type { HouseholdWithMembers, Membership };

const CODE_ATTEMPTS = 5;

function alreadyInHousehold(): ServiceError {
  return new ServiceError("ALREADY_IN_HOUSEHOLD", "You already belong to a household");
}

/** The user's membership, or null if they haven't joined a household. */
export function findMembership(userId: string): Promise<Membership | null> {
  return findMembershipByUser(userId);
}

/** A household with its members, oldest first, and each member's name. */
export function getHousehold(householdId: string): Promise<HouseholdWithMembers> {
  return findHouseholdWithMembers(householdId);
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
  if (await findMembership(userId)) throw alreadyInHousehold();

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    try {
      const household = await createHouseholdWithOwner({ name: cleanName, inviteCode: newInviteCode(), ownerId: userId });
      return await getHousehold(household.id);
    } catch (err) {
      if (!(err instanceof UniqueConflictError)) throw err;
      // Either this user joined or created a household a moment ago (two tabs),
      // or the random invite code is already taken. Only the second is worth a retry.
      if (await findMembership(userId)) throw alreadyInHousehold();
    }
  }
  throw new Error("Could not generate an unused invite code");
}

/**
 * Adds `userId` to the household with this invite code. Joining the household
 * you're already in succeeds with `joined: false`, so a double tap is harmless.
 */
export async function joinHousehold(
  userId: string,
  inviteCode: string,
): Promise<{ household: HouseholdWithMembers; joined: boolean }> {
  const code = normalizeInviteCode(inviteCode);
  if (!code) throw new ServiceError("VALIDATION_ERROR", "Enter an invite code");

  const household = await findHouseholdByInviteCode(code);
  if (!household) throw new ServiceError("INVITE_CODE_NOT_FOUND", "No household has that invite code");

  let membership = await findMembership(userId);
  let joined = false;
  if (!membership) {
    try {
      membership = await createMembership({ userId, householdId: household.id, role: "member" });
      joined = true;
    } catch (err) {
      if (!(err instanceof UniqueConflictError)) throw err;
      // The same user joined somewhere a moment ago (double tap, two tabs).
      membership = await findMembership(userId);
      if (!membership) throw err;
    }
  }
  if (membership.householdId !== household.id) throw alreadyInHousehold();
  return { household: await getHousehold(household.id), joined };
}

/** Replaces the invite code (owner only). The old code stops working immediately. */
export async function regenerateInviteCode(membership: Membership): Promise<HouseholdWithMembers> {
  if (membership.role !== "owner") {
    throw new ServiceError("FORBIDDEN", "Only the household owner can change the invite code");
  }

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    try {
      await setInviteCode(membership.householdId, newInviteCode());
      return await getHousehold(membership.householdId);
    } catch (err) {
      if (!(err instanceof UniqueConflictError)) throw err;
    }
  }
  throw new Error("Could not generate an unused invite code");
}
