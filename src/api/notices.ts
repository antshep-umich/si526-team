import type { HouseholdNotice, HouseholdNoticesResponse } from "../../shared/api.ts";

// Household notices (SCRUM-75 AC8). Never throws, like the other API helpers.

export type { HouseholdNotice };

export type NoticesResult = { ok: true; notices: HouseholdNotice[] } | { ok: false; code: string };

/** GET /api/households/current/notices: the ones this member hasn't seen. */
export async function getNotices(): Promise<NoticesResult> {
  try {
    const res = await fetch("/api/households/current/notices");
    if (res.ok) return { ok: true, notices: ((await res.json()) as HouseholdNoticesResponse).notices };
    const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    return { ok: false, code: body?.error?.code ?? `HTTP_${res.status}` };
  } catch {
    return { ok: false, code: "NETWORK_ERROR" };
  }
}

/** PUT /api/households/current/notices/seen: they won't come back. Failing is harmless: they'd show again. */
export async function markNoticesSeen(through: string): Promise<void> {
  try {
    await fetch("/api/households/current/notices/seen", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ through }),
    });
  } catch {
    // Offline: shown again next time.
  }
}
