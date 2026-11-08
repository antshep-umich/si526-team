import type { ChoreListResponse, ChoreResponse, NewChoreRequest } from "../../shared/chores.ts";

export type ChoreResult = { ok: true; chore: ChoreResponse } | { ok: false; code: string };
export type ChoreListResult = { ok: true; chores: ChoreResponse[] } | { ok: false; code: string };

type Answer = { ok: true; body: unknown } | { ok: false; code: string };

// Calls a chore route. Never throws: every failure comes back as
// { ok: false, code } so the screen can pick a message for it.
async function call(path: string, init?: RequestInit): Promise<Answer> {
  try {
    const res = await fetch(path, init);
    if (res.ok) return { ok: true, body: await res.json() };

    // Backend errors look like { error: { code, message } }
    const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    return { ok: false, code: body?.error?.code ?? `HTTP_${res.status}` };
  } catch {
    return { ok: false, code: "NETWORK_ERROR" }; // server down or offline
  }
}

async function choreCall(path: string, init: RequestInit): Promise<ChoreResult> {
  const answer = await call(path, init);
  return answer.ok ? { ok: true, chore: answer.body as ChoreResponse } : answer;
}

/**
 * GET /api/chores. Every open chore, plus the ones done or due since `since`
 * ("YYYY-MM-DD", the start of the week the screen shows).
 */
export async function listChores(since: string): Promise<ChoreListResult> {
  const answer = await call(`/api/chores?since=${encodeURIComponent(since)}`);
  return answer.ok ? { ok: true, chores: (answer.body as ChoreListResponse).chores } : answer;
}

/** GET /api/chores/history: every chore assigned to the signed-in person, latest due first. */
export async function listChoreHistory(): Promise<ChoreListResult> {
  const answer = await call("/api/chores/history");
  return answer.ok ? { ok: true, chores: (answer.body as ChoreListResponse).chores } : answer;
}

/** GET /api/chores/:id. CHORE_NOT_FOUND if it was deleted or isn't in the household. */
export function getChore(id: string): Promise<ChoreResult> {
  return choreCall(`/api/chores/${encodeURIComponent(id)}`, {});
}

/** POST /api/chores */
export function createChore(chore: NewChoreRequest): Promise<ChoreResult> {
  return choreCall("/api/chores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(chore),
  });
}

/** POST /api/chores/:id/complete. Only the assignee can. */
export function completeChore(id: string): Promise<ChoreResult> {
  return choreCall(`/api/chores/${encodeURIComponent(id)}/complete`, { method: "POST" });
}

/** DELETE /api/chores/:id/complete: marks it not done again. Only the assignee can. */
export function undoChore(id: string): Promise<ChoreResult> {
  return choreCall(`/api/chores/${encodeURIComponent(id)}/complete`, { method: "DELETE" });
}
