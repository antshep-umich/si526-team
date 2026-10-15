export type HouseholdMember = {
  userId: string;
  role: "owner" | "member";
  joinedAt: string;
};

export type Household = {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  role: "owner" | "member";
  members: HouseholdMember[];
};

export type CreateHouseholdResult =
  | { ok: true; household: Household }
  | { ok: false; code: string };

// Calls POST /api/households. Never throws: every failure comes back as
// { ok: false, code } so the screen can pick a message for it.
export async function createHousehold(name: string): Promise<CreateHouseholdResult> {
  try {
    const res = await fetch("/api/households", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) return { ok: true, household: (await res.json()) as Household };

    // Backend errors look like { error: { code, message } }
    const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    return { ok: false, code: body?.error?.code ?? `HTTP_${res.status}` };
  } catch {
    return { ok: false, code: "NETWORK_ERROR" }; // server down or offline
  }
}