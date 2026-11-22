import { findNoticesAfter, type HouseholdNotice } from "../models/notices.js";
import { setNoticesSeen, type Membership } from "../models/memberships.js";
import { ServiceError } from "./errors.js";

// Household notices (SCRUM-75 AC8): "[Name] left the household." for everyone still in it.
// Each member sees a notice once: the app shows the unseen ones, then marks them seen.
// A member never sees notices from before they joined (noticesSeenAt starts at joining).

export type { HouseholdNotice };

/** The member's household notices they haven't seen yet, oldest first. */
export function unseenNotices(membership: Membership): Promise<HouseholdNotice[]> {
  return findNoticesAfter(membership.householdId, membership.noticesSeenAt);
}

/**
 * Marks notices up to `through` (an ISO 8601 timestamp, the newest one shown) as seen.
 * Never goes backwards, or past now.
 */
export async function markNoticesSeen(membership: Membership, through: unknown): Promise<void> {
  const time = typeof through === "string" ? Date.parse(through) : Number.NaN;
  if (Number.isNaN(time)) throw new ServiceError("VALIDATION_ERROR", "through must be an ISO 8601 timestamp");
  const seenAt = new Date(Math.min(time, Date.now()));
  if (seenAt > membership.noticesSeenAt) await setNoticesSeen(membership.userId, seenAt);
}
