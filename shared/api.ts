// Types shared by the React app and the API. Zod schemas join these once the team confirms Zod.

/** Shape of every API error response (TECH_SPEC section 6). */
export interface ApiError {
  error: { code: string; message: string };
}

/** Body of a successful GET /api/health. */
export interface HealthResponse {
  status: "ok";
  database: "ok";
}

/** Builds an error body in the shared format. */
export function apiError(code: string, message: string): ApiError {
  return { error: { code, message } };
}

export type MembershipRole = "owner" | "member";

export interface HouseholdMember {
  userId: string;
  role: MembershipRole;
  /** ISO 8601 timestamp. */
  joinedAt: string;
}

/** Body of every successful /api/households response. */
export interface HouseholdResponse {
  id: string;
  name: string;
  inviteCode: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** The current user's role in this household. */
  role: MembershipRole;
  /** Oldest member first. */
  members: HouseholdMember[];
}

export const HOUSEHOLD_NAME_MAX_LENGTH = 60;

/** Returns the trimmed name, or null if it isn't 1 to 60 characters of text. */
export function parseHouseholdName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 1 && name.length <= HOUSEHOLD_NAME_MAX_LENGTH ? name : null;
}

/**
 * Cleans up a typed invite code: ignores spaces, hyphens and letter case, so
 * "abcd-efgh" matches "ABCDEFGH". Returns null if nothing usable is left.
 */
export function normalizeInviteCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.replace(/[\s-]/g, "").toUpperCase();
  return code.length >= 1 && code.length <= 32 ? code : null;
}
