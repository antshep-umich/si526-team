import { getPrisma } from "../db.js";
import type { Prisma } from "../generated/prisma/client.js";

// The Chore table (TECH_SPEC section 5). Every query here takes a householdId, so
// callers can't read or change another household's chores by accident.

/** The names to load with a chore: its assignee, creator and completer. */
const people = {
  assignee: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  completedBy: { select: { id: true, name: true } },
} as const;

/** A chore with the names of the people on it. */
export type ChoreWithPeople = Prisma.ChoreGetPayload<{ include: typeof people }>;

/**
 * The household's chores that aren't done, plus any done or due on or after `since`
 * (a UTC midnight). The screens narrow this to the person's own week.
 */
export function findChoresForHousehold(householdId: string, since: Date): Promise<ChoreWithPeople[]> {
  return getPrisma().chore.findMany({
    where: {
      householdId,
      OR: [{ completedAt: null }, { completedAt: { gte: since } }, { dueDate: { gte: since } }],
    },
    include: people,
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });
}

/** One chore, only if it belongs to this household. */
export function findChoreInHousehold(householdId: string, choreId: string): Promise<ChoreWithPeople | null> {
  return getPrisma().chore.findFirst({ where: { id: choreId, householdId }, include: people });
}

export function createChore(data: {
  householdId: string;
  name: string;
  notes: string | null;
  assigneeId: string;
  /** A UTC midnight; stored as a date without a time. */
  dueDate: Date;
  createdById: string;
}): Promise<ChoreWithPeople> {
  return getPrisma().chore.create({ data, include: people });
}

/** Marks a chore done (a time and who) or not done (null, null). */
export function setChoreCompletion(
  choreId: string,
  completion: { completedAt: Date; completedById: string } | { completedAt: null; completedById: null },
): Promise<ChoreWithPeople> {
  return getPrisma().chore.update({ where: { id: choreId }, data: completion, include: people });
}
