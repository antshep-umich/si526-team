import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../test/fakeModels.js";
import { ServiceError } from "./errors.js";
import {
  createHousehold,
  findMembership,
  getHousehold,
  joinHousehold,
  regenerateInviteCode,
} from "./households.js";

vi.mock("../models/households.js", () => import("../test/fakeModels.js"));
vi.mock("../models/memberships.js", () => import("../test/fakeModels.js"));

beforeEach(() => {
  db.reset();
});

/** Runs `fn` and returns the ServiceError code it threw. */
async function codeOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof ServiceError) return err.code;
    throw err;
  }
  throw new Error("Expected a ServiceError");
}

describe("createHousehold", () => {
  it("trims the name, makes the creator the owner and includes member names", async () => {
    const household = await createHousehold("ana", "  Maple St House  ");

    expect(household.name).toBe("Maple St House");
    expect(household.inviteCode).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(household.memberships).toEqual([
      expect.objectContaining({ userId: "ana", role: "owner", user: { name: "Ana Test" } }),
    ]);
  });

  it.each(["", "   ", "x".repeat(61)])("rejects the name %j", async (name) => {
    expect(await codeOf(() => createHousehold("ana", name))).toBe("VALIDATION_ERROR");
    expect(db.households).toHaveLength(0);
  });

  it("refuses a second household for the same user", async () => {
    await createHousehold("ana", "First");

    expect(await codeOf(() => createHousehold("ana", "Second"))).toBe("ALREADY_IN_HOUSEHOLD");
    expect(db.households).toHaveLength(1);
  });

  it("retries with a new code when the invite code is taken", async () => {
    db.codeCollisions = 3;

    await createHousehold("ana", "Maple St House");

    expect(db.households).toHaveLength(1);
  });

  it("gives up after 5 taken codes", async () => {
    db.codeCollisions = 5;

    await expect(createHousehold("ana", "Maple St House")).rejects.toThrow("Could not generate an unused invite code");
  });
});

describe("joinHousehold", () => {
  it("adds the user as a member, accepting the code in any case with spaces or hyphens", async () => {
    const { inviteCode } = await createHousehold("ana", "Maple St House");
    const typed = ` ${inviteCode.slice(0, 4).toLowerCase()}-${inviteCode.slice(4)} `;

    const { household, joined } = await joinHousehold("ben", typed);

    expect(joined).toBe(true);
    expect(household.memberships.map((m) => [m.userId, m.role])).toEqual([
      ["ana", "owner"],
      ["ben", "member"],
    ]);
  });

  it("rejects an empty code", async () => {
    expect(await codeOf(() => joinHousehold("ben", " - "))).toBe("VALIDATION_ERROR");
  });

  it("reports a code no household has", async () => {
    expect(await codeOf(() => joinHousehold("ben", "ZZZZZZZZ"))).toBe("INVITE_CODE_NOT_FOUND");
  });

  it("succeeds without a duplicate (joined: false) when the user is already in that household", async () => {
    const { inviteCode } = await createHousehold("ana", "Maple St House");
    await joinHousehold("ben", inviteCode);

    const { household, joined } = await joinHousehold("ben", inviteCode);

    expect(joined).toBe(false);
    expect(household.memberships).toHaveLength(2);
  });

  it("refuses a user who belongs to a different household", async () => {
    const { inviteCode } = await createHousehold("ana", "Maple St House");
    await createHousehold("cy", "Other House");

    expect(await codeOf(() => joinHousehold("cy", inviteCode))).toBe("ALREADY_IN_HOUSEHOLD");
  });
});

describe("findMembership and getHousehold", () => {
  it("finds the user's membership, or null when they have none", async () => {
    const household = await createHousehold("ana", "Maple St House");

    expect(await findMembership("ana")).toMatchObject({ householdId: household.id, role: "owner" });
    expect(await findMembership("ben")).toBeNull();
  });

  it("loads a household with its members oldest first", async () => {
    const { id, inviteCode } = await createHousehold("ana", "Maple St House");
    await joinHousehold("ben", inviteCode);

    const household = await getHousehold(id);

    expect(household.memberships.map((m) => m.user.name)).toEqual(["Ana Test", "Ben Test"]);
  });
});

describe("regenerateInviteCode", () => {
  it("gives the household a new code when the owner asks", async () => {
    const { inviteCode } = await createHousehold("ana", "Maple St House");

    const household = await regenerateInviteCode((await findMembership("ana"))!);

    expect(household.inviteCode).not.toBe(inviteCode);
    expect(db.households[0]?.inviteCode).toBe(household.inviteCode);
  });

  it("refuses a member who isn't the owner", async () => {
    const { inviteCode } = await createHousehold("ana", "Maple St House");
    await joinHousehold("ben", inviteCode);

    expect(await codeOf(async () => regenerateInviteCode((await findMembership("ben"))!))).toBe("FORBIDDEN");
    expect(db.households[0]?.inviteCode).toBe(inviteCode);
  });

  it("retries when the new code is taken", async () => {
    await createHousehold("ana", "Maple St House");
    db.codeCollisions = 2;

    await expect(regenerateInviteCode((await findMembership("ana"))!)).resolves.toBeDefined();
  });
});
