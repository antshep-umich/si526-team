import {
  isIsoDate,
  parseChoreName,
  parseChoreNotes,
  CHORE_NAME_MAX_LENGTH,
  CHORE_NOTES_MAX_LENGTH,
} from "../../shared/chores.js";
import {
  createChore as insertChore,
  findChoreInHousehold,
  findChoresForHousehold,
  setChoreCompletion,
  type ChoreWithPeople,
} from "../models/chores.js";
import { findMembershipByUser, type Membership } from "../models/memberships.js";
import { ServiceError } from "./errors.js";

// Chore rules (Jira SCRUM-6 Add a Chore, SCRUM-7 View the Chore List, SCRUM-8 Mark a
// Chore Done). Every function takes the caller's membership, so a chore is only
// ever found inside the caller's own household.

export type { ChoreWithPeople };

const DAY_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "YYYY-MM-DD" → that date's UTC midnight, the form Prisma uses for date-only columns. */
function utcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

/** Today's UTC date, minus `days`. */
function utcDaysAgo(days: number, now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - days * DAY_MS);
}

function choreNotFound(): ServiceError {
  return new ServiceError("CHORE_NOT_FOUND", "That chore isn't in your household.");
}

async function findOwnChore(membership: Membership, choreId: string): Promise<ChoreWithPeople> {
  if (!UUID.test(choreId)) throw choreNotFound();
  const chore = await findChoreInHousehold(membership.householdId, choreId);
  if (!chore) throw choreNotFound();
  return chore;
}

/**
 * The household's chores that aren't done, plus those done or due since `since`
 * ("YYYY-MM-DD", the start of the person's week; default: 7 days ago). One extra day
 * is included because the person's date can be a day behind UTC.
 */
export function listChores(membership: Membership, since?: string): Promise<ChoreWithPeople[]> {
  if (since !== undefined && !isIsoDate(since)) {
    throw new ServiceError("VALIDATION_ERROR", "since must be a date written YYYY-MM-DD");
  }
  const from = since ? new Date(utcDate(since).getTime() - DAY_MS) : utcDaysAgo(8);
  return findChoresForHousehold(membership.householdId, from);
}

export function getChore(membership: Membership, choreId: string): Promise<ChoreWithPeople> {
  return findOwnChore(membership, choreId);
}

/**
 * Adds a chore (SCRUM-6). Any member can add one and assign it to any member,
 * including themself. The due date can't be in the past: the screen checks the
 * person's own "today"; here anything from yesterday (UTC) on is accepted, because
 * a phone west of UTC can still be on yesterday's date.
 */
export async function addChore(
  membership: Membership,
  input: { name: string; assigneeId: string; dueDate: string; notes: unknown },
): Promise<ChoreWithPeople> {
  const name = parseChoreName(input.name);
  if (!name) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      input.name.trim()
        ? `Chore name must be ${CHORE_NAME_MAX_LENGTH} characters or fewer.`
        : "Chore name is required.",
    );
  }
  if (!input.assigneeId) {
    throw new ServiceError("VALIDATION_ERROR", "Choose who this chore is assigned to.");
  }
  if (!isIsoDate(input.dueDate)) throw new ServiceError("VALIDATION_ERROR", "Choose a due date.");
  const dueDate = utcDate(input.dueDate);
  if (dueDate < utcDaysAgo(1)) throw new ServiceError("DUE_DATE_IN_PAST", "Due date can't be in the past.");
  const notes = parseChoreNotes(input.notes);
  if (notes === undefined) {
    throw new ServiceError("VALIDATION_ERROR", `Notes must be ${CHORE_NOTES_MAX_LENGTH} characters or fewer.`);
  }

  const assignee = await findMembershipByUser(input.assigneeId);
  if (assignee?.householdId !== membership.householdId) {
    throw new ServiceError("ASSIGNEE_NOT_IN_HOUSEHOLD", "That person isn't in your household.");
  }

  return insertChore({
    householdId: membership.householdId,
    name,
    notes,
    assigneeId: input.assigneeId,
    dueDate,
    createdById: membership.userId,
  });
}

/** Only the assignee can mark a chore done or undo it (SCRUM-8). */
function assertAssignee(membership: Membership, chore: ChoreWithPeople) {
  if (chore.assigneeId !== membership.userId) {
    throw new ServiceError("NOT_ASSIGNEE", "Only the person this chore is assigned to can mark it done.");
  }
}

/** Marks a chore done now. Doing it twice is harmless: the first time stands. */
export async function completeChore(membership: Membership, choreId: string): Promise<ChoreWithPeople> {
  const chore = await findOwnChore(membership, choreId);
  assertAssignee(membership, chore);
  if (chore.completedAt) return chore;
  return setChoreCompletion(chore.id, { completedAt: new Date(), completedById: membership.userId });
}

/** Undoes "done": the chore goes back to To do, or Overdue if its due date has passed. */
export async function undoChore(membership: Membership, choreId: string): Promise<ChoreWithPeople> {
  const chore = await findOwnChore(membership, choreId);
  assertAssignee(membership, chore);
  if (!chore.completedAt) return chore;
  return setChoreCompletion(chore.id, { completedAt: null, completedById: null });
}
