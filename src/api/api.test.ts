// The frontend's API helpers (households.ts, chores.ts, passwordReset.ts). fetch is replaced
// with a stand-in, so these check the requests sent and how answers are read.
import { afterEach, describe, expect, it, vi } from "vitest";
import { completeChore, createChore, listChores, undoChore } from "./chores.ts";
import { createHousehold, getCurrentHousehold, joinHousehold } from "./households.ts";
import { resetPassword } from "./passwordReset.ts";

const household = {
  id: "h1",
  name: "Maple St House",
  inviteCode: "ABCDEFGH",
  createdAt: "2026-10-17T00:00:00.000Z",
  role: "owner",
  members: [{ userId: "u1", name: "Ana", role: "owner", joinedAt: "2026-10-17T00:00:00.000Z" }],
};

function answer(status: number, body?: unknown) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));
}

const apiError = (code: string) => ({ error: { code, message: "message" } });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("household helpers", () => {
  it("getCurrentHousehold reads GET /api/households/current", async () => {
    const fetch = answer(200, household);

    expect(await getCurrentHousehold()).toEqual({ ok: true, household });
    expect(fetch).toHaveBeenCalledWith("/api/households/current", undefined);
  });

  it("createHousehold posts the name as JSON", async () => {
    const fetch = answer(201, household);

    expect(await createHousehold("Maple St House")).toEqual({ ok: true, household });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("/api/households");
    expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" } });
    expect(JSON.parse(init!.body as string)).toEqual({ name: "Maple St House" });
  });

  it("joinHousehold posts the invite code", async () => {
    const fetch = answer(200, household);

    await joinHousehold("abcd-efgh");

    expect(fetch.mock.calls[0]![0]).toBe("/api/households/join");
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({ inviteCode: "abcd-efgh" });
  });

  it("returns the API's error code instead of throwing", async () => {
    answer(404, apiError("NO_HOUSEHOLD"));

    expect(await getCurrentHousehold()).toEqual({ ok: false, code: "NO_HOUSEHOLD" });
  });

  it("falls back to HTTP_<status> when the error body isn't ours", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));

    expect(await getCurrentHousehold()).toEqual({ ok: false, code: "HTTP_502" });
  });

  it("reports NETWORK_ERROR when the server can't be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    expect(await createHousehold("Maple St House")).toEqual({ ok: false, code: "NETWORK_ERROR" });
  });
});

describe("resetPassword", () => {
  it("posts the email and new password, and succeeds on 204", async () => {
    const fetch = answer(204);

    expect(await resetPassword("ana@example.com", "new-password-1")).toEqual({ ok: true });
    expect(fetch.mock.calls[0]![0]).toBe("/api/password-reset");
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
      email: "ana@example.com",
      newPassword: "new-password-1",
    });
  });

  it("returns the API's error code", async () => {
    answer(404, apiError("ACCOUNT_NOT_FOUND"));

    expect(await resetPassword("nobody@example.com", "new-password-1")).toEqual({
      ok: false,
      code: "ACCOUNT_NOT_FOUND",
    });
  });

  it("reports NETWORK_ERROR when the server can't be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    expect(await resetPassword("ana@example.com", "new-password-1")).toEqual({ ok: false, code: "NETWORK_ERROR" });
  });
});

describe("chore helpers", () => {
  const chore = {
    id: "c1",
    name: "Take out trash",
    notes: null,
    dueDate: "2026-10-30",
    assignee: { userId: "u1", name: "Ana" },
    createdBy: { userId: "u1", name: "Ana" },
    createdAt: "2026-10-29T15:00:00.000Z",
    completedAt: null,
    completedBy: null,
  };

  it("listChores asks for the chores since a date", async () => {
    const fetch = answer(200, { chores: [chore] });

    expect(await listChores("2026-10-26")).toEqual({ ok: true, chores: [chore] });
    expect(fetch).toHaveBeenCalledWith("/api/chores?since=2026-10-26", undefined);
  });

  it("createChore posts the new chore as JSON", async () => {
    const fetch = answer(201, chore);
    const body = { name: "Take out trash", assigneeId: "u1", dueDate: "2026-10-30" };

    expect(await createChore(body)).toEqual({ ok: true, chore });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("/api/chores");
    expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" } });
    expect(JSON.parse(init!.body as string)).toEqual(body);
  });

  it("completeChore posts, and undoChore deletes, the chore's completion", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(JSON.stringify(chore), { status: 200 }));

    expect(await completeChore("c1")).toEqual({ ok: true, chore });
    expect(await undoChore("c1")).toEqual({ ok: true, chore });
    expect(fetch.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["/api/chores/c1/complete", "POST"],
      ["/api/chores/c1/complete", "DELETE"],
    ]);
  });

  it("returns the API's error code, or NETWORK_ERROR, instead of throwing", async () => {
    answer(403, apiError("NOT_ASSIGNEE"));
    expect(await completeChore("c1")).toEqual({ ok: false, code: "NOT_ASSIGNEE" });

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await listChores("2026-10-26")).toEqual({ ok: false, code: "NETWORK_ERROR" });
  });
});
