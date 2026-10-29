import type { HouseholdResponse } from "../../shared/api.ts";

export type Household = HouseholdResponse;

export type HouseholdResult = { ok: true; household: Household } | { ok: false; code: string };

// Calls a household route. Never throws: every failure comes back as
// { ok: false, code } so the screen can pick a message for it.
async function call(path: string, init?: RequestInit): Promise<HouseholdResult> {
  try {
    const res = await fetch(path, init);
    if (res.ok) return { ok: true, household: (await res.json()) as Household };

    // Backend errors look like { error: { code, message } }
    const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    return { ok: false, code: body?.error?.code ?? `HTTP_${res.status}` };
  } catch {
    return { ok: false, code: "NETWORK_ERROR" }; // server down or offline
  }
}

function post(path: string, body?: object): Promise<HouseholdResult> {
  return call(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

/** GET /api/households/current. Fails with code NO_HOUSEHOLD if the user hasn't joined one. */
export function getCurrentHousehold(): Promise<HouseholdResult> {
  return call("/api/households/current");
}

/** POST /api/households */
export function createHousehold(name: string): Promise<HouseholdResult> {
  return post("/api/households", { name });
}

/** POST /api/households/join */
export function joinHousehold(inviteCode: string): Promise<HouseholdResult> {
  return post("/api/households/join", { inviteCode });
}
