// SCRUM-72 profile preferences, shared by the profile screen and the server.
// The options are Figma's "User Profile" frame (637:197). Ids are stored; labels are shown.

/** "Set chore preferences": the kinds of chores a member would like to be assigned. */
export const CHORE_TYPES = [
  { id: "dishes", label: "Dishes" },
  { id: "laundry", label: "Laundry" },
  { id: "vacuuming", label: "Vacuuming" },
  { id: "trash", label: "Trash & recycling" },
  { id: "bathroom", label: "Bathroom" },
  { id: "yard", label: "Yard Work" },
  { id: "cooking", label: "Cooking" },
  { id: "mopping", label: "Mopping" },
] as const;

export type ChoreType = (typeof CHORE_TYPES)[number]["id"];

/**
 * "Weekly workload": how many chores a week the member wants. Figma shows only
 * "Medium (3-4 chores)"; Light and Heavy are placeholders until UX sets them.
 */
export const WEEKLY_WORKLOADS = [
  { id: "light", label: "Light (1-2 chores)" },
  { id: "medium", label: "Medium (3-4 chores)" },
  { id: "heavy", label: "Heavy (5+ chores)" },
] as const;

export type WeeklyWorkload = (typeof WEEKLY_WORKLOADS)[number]["id"];

/** "Set household manager preferences": how the household's chores get assigned. */
export const ASSIGNMENT_METHODS = [
  { id: "rotate", label: "Rotate evenly", description: "Everyone takes turns on every chore." },
  { id: "preferences", label: "Match preferences", description: "Assign chores based on member's preferences." },
  { id: "manager", label: "Manager assigns", description: "The household manager picks chores by hand." },
] as const;

export type AssignmentMethod = (typeof ASSIGNMENT_METHODS)[number]["id"];

/** Body of GET and PUT /api/households/current/preferences: the signed-in member's own. */
export interface ChorePreferences {
  /** In CHORE_TYPES order, no repeats. Empty if none are chosen. */
  choreTypes: ChoreType[];
  /** Null until the member picks one. */
  weeklyWorkload: WeeklyWorkload | null;
}

const isOneOf = <T extends string>(options: readonly { id: T }[], value: unknown): value is T =>
  options.some((o) => o.id === value);

/**
 * Checks a PUT body. Returns the preferences with chore types in CHORE_TYPES order and
 * repeats dropped, or null if anything is unknown or missing.
 */
export function parseChorePreferences(value: unknown): ChorePreferences | null {
  if (typeof value !== "object" || value === null) return null;
  const { choreTypes, weeklyWorkload } = value as Record<string, unknown>;
  if (!Array.isArray(choreTypes) || !choreTypes.every((t) => isOneOf(CHORE_TYPES, t))) return null;
  if (weeklyWorkload !== null && !isOneOf(WEEKLY_WORKLOADS, weeklyWorkload)) return null;
  return {
    choreTypes: CHORE_TYPES.map((t) => t.id).filter((id) => choreTypes.includes(id)),
    weeklyWorkload,
  };
}

/** Returns the method, or null if it isn't one of ASSIGNMENT_METHODS. */
export function parseAssignmentMethod(value: unknown): AssignmentMethod | null {
  return isOneOf(ASSIGNMENT_METHODS, value) ? value : null;
}
