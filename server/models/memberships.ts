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

/**
 * Takes the user out of their household in one write (SCRUM-75): their open chores there
 * become unassigned, their membership goes, and housemates get a "left" notice. Done chores
 * keep their name. If nobody is left, the household is deleted with all of its chores.
 */
export async function removeMembership(userId: string): Promise<{ householdDeleted: boolean }> {
  return getPrisma().$transaction(async (tx) => {
    const gone = await tx.membership.delete({ where: { userId }, include: { user: { select: { name: true } } } });
    const householdId = gone.householdId;
    // Counted after the delete, so two last members leaving at once can't leave an empty household.
    if ((await tx.membership.count({ where: { householdId } })) === 0) {
      await tx.household.delete({ where: { id: householdId } });
      return { householdDeleted: true };
    }
    await tx.chore.updateMany({ where: { householdId, assigneeId: userId, completedAt: null }, data: { assigneeId: null } });
    await tx.householdNotice.create({ data: { householdId, kind: "member_left", personName: gone.user.name } });
    return { householdDeleted: false };
  });
}

/** Marks household notices up to `seenAt` as shown to this member (SCRUM-75). */
export function setNoticesSeen(userId: string, seenAt: Date): Promise<Membership> {
  return getPrisma().membership.update({ where: { userId }, data: { noticesSeenAt: seenAt } });
}
