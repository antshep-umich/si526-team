import {
  choreKey,
  parseAssignmentMethod,
  parseChorePreferences,
  parsePreferredChoreNames,
  type ChorePreferences,
  type ChoreType,
  type PreferredChoresResponse,
} from "../../shared/preferences.js";
import { findChoreNames } from "../models/chores.js";
import { findHouseholdWithMembers, setAssignmentMethod, type HouseholdWithMembers } from "../models/households.js";
import { setChorePreferences, setPreferredChores, type Membership } from "../models/memberships.js";
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

/**
 * The household's chores, one per name (its newest spelling), A to Z, each marked if
 * it's one of the member's preferred chores (SCRUM-61).
 */
export async function listPreferredChores(membership: Membership): Promise<PreferredChoresResponse> {
  const byKey = new Map<string, string>();
  for (const { name } of await findChoreNames(membership.householdId)) {
    if (!byKey.has(choreKey(name))) byKey.set(choreKey(name), name.trim());
  }
  const preferred = new Set(membership.preferredChores);
  return {
    chores: [...byKey]
      .sort(([, a], [, b]) => a.localeCompare(b, "en", { sensitivity: "base" }))
      .map(([key, name]) => ({ name, preferred: preferred.has(key) })),
  };
}

/** Replaces the member's preferred chores with `input.names`, which must be household chores. */
export async function savePreferredChores(membership: Membership, input: unknown): Promise<PreferredChoresResponse> {
  const keys = parsePreferredChoreNames(input);
  if (!keys) throw new ServiceError("VALIDATION_ERROR", "Send the names of the chores you prefer");
  const known = new Set((await findChoreNames(membership.householdId)).map(({ name }) => choreKey(name)));
  if (!keys.every((key) => known.has(key))) {
    throw new ServiceError("VALIDATION_ERROR", "Choose from the household's chores");
  }
  const saved = await setPreferredChores(membership.userId, keys);
  return listPreferredChores(saved);
}
