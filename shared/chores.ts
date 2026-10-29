// Chores: the API's shapes and input rules, shared by the React app and the API
// (TECH_SPEC sections 5 and 6, Jira SCRUM-6, 7 and 8).

export const CHORE_NAME_MAX_LENGTH = 60;
export const CHORE_NOTES_MAX_LENGTH = 200;

/** A person as a chore shows them. Housemates see names only, never emails. */
export interface ChorePerson {
  userId: string;
  name: string;
}

/** One chore, as every /api/chores response returns it. */
export interface ChoreResponse {
  id: string;
  name: string;
  notes: string | null;
  /** "YYYY-MM-DD", a calendar date without a time. */
  dueDate: string;
  /** null only if the assignee's account was deleted. */
  assignee: ChorePerson | null;
  createdBy: ChorePerson | null;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** ISO 8601 timestamp, or null while the chore isn't done. */
  completedAt: string | null;
  completedBy: ChorePerson | null;
}

/** Body of GET /api/chores. */
export interface ChoreListResponse {
  chores: ChoreResponse[];
}

/** Body of POST /api/chores. */
export interface NewChoreRequest {
  name: string;
  assigneeId: string;
  /** "YYYY-MM-DD" */
  dueDate: string;
  notes?: string;
}

/** Returns the trimmed name, or null if it isn't 1 to 60 characters of text. */
export function parseChoreName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 1 && name.length <= CHORE_NAME_MAX_LENGTH ? name : null;
}

/**
 * Returns the trimmed notes, null for none (missing or blank), or undefined if
 * they're too long or not text.
 */
export function parseChoreNotes(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const notes = value.trim();
  if (notes.length === 0) return null;
  return notes.length <= CHORE_NOTES_MAX_LENGTH ? notes : undefined;
}

/** True for a real calendar date written "YYYY-MM-DD" (so not "2026-02-30"). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
