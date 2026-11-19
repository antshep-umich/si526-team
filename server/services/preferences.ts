import {
  parseAssignmentMethod,
  parseChorePreferences,
  type ChorePreferences,
  type ChoreType,
} from "../../shared/preferences.js";
import { findHouseholdWithMembers, setAssignmentMethod, type HouseholdWithMembers } from "../models/households.js";
import { setChorePreferences, type Membership } from "../models/memberships.js";
import { ServiceError } from "./errors.js";

// SCRUM-72 profile preferences. Each member sets their own chore preferences;
// only the owner sets how the household's chores get assigned (team decision,
// README Conflicts). Nothing assigns chores from these yet.

/** The member's own chore preferences, as stored. */
export function chorePreferencesOf(membership: Membership): ChorePreferences {
  return {
    // Only CHORE_TYPES ids are ever saved (parseChorePreferences).
    choreTypes: membership.choreTypes as ChoreType[],
    weeklyWorkload: membership.weeklyWorkload,
  };
}

/** Replaces the member's chore preferences. `input` is the request body. */
export async function saveChorePreferences(membership: Membership, input: unknown): Promise<ChorePreferences> {
  const preferences = parseChorePreferences(input);
  if (!preferences) {
    throw new ServiceError("VALIDATION_ERROR", "Choose chore preferences and a weekly workload from the list");
  }
  return chorePreferencesOf(await setChorePreferences(membership.userId, preferences));
}

/** Sets how the household's chores get assigned (owner only). */
export async function saveAssignmentMethod(membership: Membership, input: unknown): Promise<HouseholdWithMembers> {
  if (membership.role !== "owner") {
    throw new ServiceError("FORBIDDEN", "Only the household owner can change how chores are assigned");
  }
  const method = parseAssignmentMethod(input);
  if (!method) throw new ServiceError("VALIDATION_ERROR", "Choose an assignment method from the list");
  await setAssignmentMethod(membership.householdId, method);
  return findHouseholdWithMembers(membership.householdId);
}
