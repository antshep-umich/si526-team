// The chore model's Prisma queries, against a stub Prisma client.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChore, findChoreInHousehold, findChoresForHousehold, setChoreCompletion } from "./chores.js";

const { prisma } = vi.hoisted(() => ({
  prisma: { chore: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() } },
}));
vi.mock("../db.js", () => ({ getPrisma: () => prisma }));

const people = {
  assignee: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  completedBy: { select: { id: true, name: true } },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("chores model", () => {
  it("lists a household's chores that aren't done, or are done or due since a date, soonest due first", async () => {
    const since = new Date("2026-10-26T00:00:00Z");

    await findChoresForHousehold("h1", since);

    expect(prisma.chore.findMany).toHaveBeenCalledWith({
      where: {
        householdId: "h1",
        OR: [{ completedAt: null }, { completedAt: { gte: since } }, { dueDate: { gte: since } }],
      },
      include: people,
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });
  });

  it("finds a chore only within the given household", async () => {
    await findChoreInHousehold("h1", "c1");

    expect(prisma.chore.findFirst).toHaveBeenCalledWith({ where: { id: "c1", householdId: "h1" }, include: people });
  });

  it("creates a chore with its people's names", async () => {
    const data = {
      householdId: "h1",
      name: "Take out trash",
      notes: null,
      assigneeId: "ana",
      dueDate: new Date("2026-10-30T00:00:00Z"),
      createdById: "ben",
    };

    await createChore(data);

    expect(prisma.chore.create).toHaveBeenCalledWith({ data, include: people });
  });

  it("sets and clears completion", async () => {
    const at = new Date("2026-10-29T15:00:00Z");

    await setChoreCompletion("c1", { completedAt: at, completedById: "ana" });
    await setChoreCompletion("c1", { completedAt: null, completedById: null });

    expect(prisma.chore.update).toHaveBeenNthCalledWith(1, {
      where: { id: "c1" },
      data: { completedAt: at, completedById: "ana" },
      include: people,
    });
    expect(prisma.chore.update).toHaveBeenNthCalledWith(2, {
      where: { id: "c1" },
      data: { completedAt: null, completedById: null },
      include: people,
    });
  });
});
