import type { AssignmentMethod, ChorePreferences, PreferredChoresResponse } from "../../shared/preferences.ts";
import type { Household, HouseholdResult } from "./households.ts";

// SCRUM-72 profile preferences. Never throws: failures come back as { ok: false, code }.

export type PreferencesResult = { ok: true; preferences: ChorePreferences } | { ok: false; code: string };

async function send<T>(path: string, init: RequestInit | undefined, read: (body: unknown) => T) {
  try {
    const res = await fetch(path, init);
    if (res.ok) return { ok: true as const, ...read(await res.json()) };
    const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    return { ok: false as const, code: body?.error?.code ?? `HTTP_${res.status}` };
  } catch {
    return { ok: false as const, code: "NETWORK_ERROR" };
  }
}

const put = (body: object): RequestInit => ({
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const asPreferences = (body: unknown) => ({ preferences: body as ChorePreferences });

/** GET /api/households/current/preferences: the signed-in member's own. */
export function getChorePreferences(): Promise<PreferencesResult> {
  return send("/api/households/current/preferences", undefined, asPreferences);
}

/** PUT /api/households/current/preferences */
export function saveChorePreferences(preferences: ChorePreferences): Promise<PreferencesResult> {
  return send("/api/households/current/preferences", put(preferences), asPreferences);
}

/** PUT /api/households/current/assignment-method (owner only; FORBIDDEN otherwise). */
export function saveAssignmentMethod(assignmentMethod: AssignmentMethod): Promise<HouseholdResult> {
  return send("/api/households/current/assignment-method", put({ assignmentMethod }), (body) => ({
    household: body as Household,
  }));
}

export type PreferredChoresResult = { ok: true; chores: PreferredChoresResponse["chores"] } | { ok: false; code: string };

const asPreferredChores = (body: unknown) => ({ chores: (body as PreferredChoresResponse).chores });

/** GET /api/households/current/preferred-chores (SCRUM-61). */
export function getPreferredChores(): Promise<PreferredChoresResult> {
  return send("/api/households/current/preferred-chores", undefined, asPreferredChores);
}

/** PUT /api/households/current/preferred-chores with the names of the chores to prefer. */
export function savePreferredChores(names: string[]): Promise<PreferredChoresResult> {
  return send("/api/households/current/preferred-chores", put({ names }), asPreferredChores);
}
