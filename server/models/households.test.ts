// The household and membership models' Prisma queries, against a stub Prisma client.
// (Services and routes are tested with in-memory fake models; e2e uses the real database.)
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UniqueConflictError } from "./errors.js";
import {
  checkHouseholdTable,
  createHouseholdWithOwner,
  findHouseholdByInviteCode,
  findHouseholdWithMembers,
  setInviteCode,
} from "./households.js";
import { createMembership, findMembershipByUser } from "./memberships.js";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    household: {
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    membership: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));
vi.mock("../db.js", () => ({ getPrisma: () => prisma }));

const prismaUniqueViolation = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("households model", () => {
  it("loads a household with members oldest first, including only their names", async () => {
    await findHouseholdWithMembers("h1");

    expect(prisma.household.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "h1" },
      include: {
        memberships: { orderBy: { joinedAt: "asc" }, include: { user: { select: { name: true } } } },
      },
    });
  });

  it("finds a household by invite code", async () => {
    await findHouseholdByInviteCode("ABCDEFGH");

    expect(prisma.household.findUnique).toHaveBeenCalledWith({ where: { inviteCode: "ABCDEFGH" } });
  });

  it("creates the household and its owner's membership in one write", async () => {
    await createHouseholdWithOwner({ name: "Maple St House", inviteCode: "ABCDEFGH", ownerId: "ana" });

    expect(prisma.household.create).toHaveBeenCalledWith({
      data: {
        name: "Maple St House",
        inviteCode: "ABCDEFGH",
        memberships: { create: { userId: "ana", role: "owner" } },
      },
    });
  });

  it("replaces the invite code", async () => {
    await setInviteCode("h1", "HGFEDCBA");

    expect(prisma.household.update).toHaveBeenCalledWith({ where: { id: "h1" }, data: { inviteCode: "HGFEDCBA" } });
  });

  it.each([
    ["createHouseholdWithOwner", () => createHouseholdWithOwner({ name: "n", inviteCode: "c", ownerId: "u" }), "create"],
    ["setInviteCode", () => setInviteCode("h1", "c"), "update"],
  ] as const)("%s reports a taken code as UniqueConflictError", async (_name, write, method) => {
    prisma.household[method].mockRejectedValue(prismaUniqueViolation());

    await expect(write()).rejects.toBeInstanceOf(UniqueConflictError);
  });

  it("lets other database errors through unchanged", async () => {
    const outage = new Error("Can't reach database server");
    prisma.household.create.mockRejectedValue(outage);

    await expect(createHouseholdWithOwner({ name: "n", inviteCode: "c", ownerId: "u" })).rejects.toBe(outage);
  });

  it("checks the Household table for the health check", async () => {
    await checkHouseholdTable();

    expect(prisma.household.findFirst).toHaveBeenCalledWith({ select: { id: true } });
  });
});

describe("memberships model", () => {
  it("finds a membership by user", async () => {
    await findMembershipByUser("ana");

    expect(prisma.membership.findUnique).toHaveBeenCalledWith({ where: { userId: "ana" } });
  });

  it("creates a membership, reporting a second one for the same user as UniqueConflictError", async () => {
    await createMembership({ userId: "ben", householdId: "h1", role: "member" });
    expect(prisma.membership.create).toHaveBeenCalledWith({ data: { userId: "ben", householdId: "h1", role: "member" } });

    prisma.membership.create.mockRejectedValue(prismaUniqueViolation());
    await expect(createMembership({ userId: "ben", householdId: "h2", role: "member" })).rejects.toBeInstanceOf(
      UniqueConflictError,
    );
  });
});
