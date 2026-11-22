import { getPrisma } from "../db.js";
import type { HouseholdNotice } from "../generated/prisma/client.js";

// The HouseholdNotice table (SCRUM-75 AC8): news for a household's members, such as
// "[Name] left the household." Each member's Membership.noticesSeenAt says what they've seen.
// Notices are written by models/memberships.ts removeMembership.

export type { HouseholdNotice };

/** The household's notices after `after`, oldest first. */
export function findNoticesAfter(householdId: string, after: Date): Promise<HouseholdNotice[]> {
  return getPrisma().householdNotice.findMany({
    where: { householdId, createdAt: { gt: after } },
    orderBy: { createdAt: "asc" },
  });
}
