// The frontend's API helpers (households.ts, passwordReset.ts). fetch is replaced
// with a stand-in, so these check the requests sent and how answers are read.
import { afterEach, describe, expect, it, vi } from "vitest";
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
