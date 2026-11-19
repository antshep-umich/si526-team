import { getPrisma } from "../db.js";
import type { Membership } from "../generated/prisma/client.js";
import { translateUniqueConflict } from "./errors.js";

// The Membership table: who belongs to which household, and as what.
// userId is unique, so a user has at most one membership (TECH_SPEC section 5).

export type { Membership };
export type MembershipRole = Membership["role"];
export type WeeklyWorkload = NonNullable<Membership["weeklyWorkload"]>;

/** The user's membership, or null if they haven't joined a household. */
export function findMembershipByUser(userId: string): Promise<Membership | null> {
  return getPrisma().membership.findUnique({ where: { userId } });
}

/** Adds a membership. Throws UniqueConflictError if the user already has one. */
export function createMembership(data: {
  userId: string;
  householdId: string;
  role: MembershipRole;
}): Promise<Membership> {
  return translateUniqueConflict(() => getPrisma().membership.create({ data }));
}

/** Saves the member's chore preferences (SCRUM-72). */
export function setChorePreferences(
  userId: string,
  data: { choreTypes: string[]; weeklyWorkload: WeeklyWorkload | null },
): Promise<Membership> {
  return getPrisma().membership.update({ where: { userId }, data });
}

/** Saves the member's preferred chores, as chore keys (SCRUM-61). */
export function setPreferredChores(userId: string, preferredChores: string[]): Promise<Membership> {
  return getPrisma().membership.update({ where: { userId }, data: { preferredChores } });
}
