// models/memberships.ts removeMembership and setNoticesSeen, and models/notices.ts, against
// a stub Prisma client whose transaction runs the callback on the same stub.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { removeMembership, setNoticesSeen } from "./memberships.js";
import { findNoticesAfter } from "./notices.js";

const { prisma } = vi.hoisted(() => {
  const prisma = {
    $transaction: vi.fn(),
    membership: { delete: vi.fn(), count: vi.fn(), update: vi.fn() },
    household: { delete: vi.fn() },
    chore: { updateMany: vi.fn() },
    householdNotice: { create: vi.fn(), findMany: vi.fn() },
  };
  return { prisma };
});
vi.mock("../db.js", () => ({ getPrisma: () => prisma }));

beforeEach(() => {
  vi.resetAllMocks();
  prisma.$transaction.mockImplementation((work: (tx: typeof prisma) => unknown) => work(prisma));
  prisma.membership.delete.mockResolvedValue({ userId: "ben", householdId: "h1", user: { name: "Ben Ito" } });
});

describe("removeMembership", () => {
  it("unassigns the member's open chores there and tells the housemates, in one transaction", async () => {
    prisma.membership.count.mockResolvedValue(2);

    expect(await removeMembership("ben")).toEqual({ householdDeleted: false });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.membership.delete).toHaveBeenCalledWith({ where: { userId: "ben" }, include: { user: { select: { name: true } } } });
    expect(prisma.chore.updateMany).toHaveBeenCalledWith({
      where: { householdId: "h1", assigneeId: "ben", completedAt: null },
      data: { assigneeId: null },
    });
    expect(prisma.householdNotice.create).toHaveBeenCalledWith({
      data: { householdId: "h1", kind: "member_left", personName: "Ben Ito" },
    });
    expect(prisma.household.delete).not.toHaveBeenCalled();
  });

  it("deletes the household when nobody is left", async () => {
    prisma.membership.count.mockResolvedValue(0);

    expect(await removeMembership("ben")).toEqual({ householdDeleted: true });

    expect(prisma.household.delete).toHaveBeenCalledWith({ where: { id: "h1" } });
    expect(prisma.householdNotice.create).not.toHaveBeenCalled();
  });
});

describe("notices", () => {
  it("finds a household's notices after a time, oldest first", async () => {
    const after = new Date("2026-11-22T12:00:00Z");
    await findNoticesAfter("h1", after);

    expect(prisma.householdNotice.findMany).toHaveBeenCalledWith({
      where: { householdId: "h1", createdAt: { gt: after } },
      orderBy: { createdAt: "asc" },
    });
  });

  it("saves how far the member has seen", async () => {
    const seenAt = new Date("2026-11-22T12:00:00Z");
    await setNoticesSeen("ana", seenAt);

    expect(prisma.membership.update).toHaveBeenCalledWith({ where: { userId: "ana" }, data: { noticesSeenAt: seenAt } });
  });
});
