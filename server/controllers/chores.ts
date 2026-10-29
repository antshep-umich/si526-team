import type { RequestHandler } from "express";
import type { ChoreListResponse, ChorePerson, ChoreResponse } from "../../shared/chores.js";
import { HttpStatus } from "../../shared/httpStatus.js";
import { currentMembership } from "../middleware/household.js";
import {
  addChore,
  completeChore,
  getChore,
  listChores,
  undoChore,
  type ChoreWithPeople,
} from "../services/chores.js";
import { bodyText } from "./body.js";

// Chore endpoints (TECH_SPEC section 6). Mounted behind requireHousehold, so every
// request has the caller's membership, and every chore comes from their household.

function toPerson(person: { id: string; name: string } | null): ChorePerson | null {
  return person ? { userId: person.id, name: person.name } : null;
}

/** The API shape of a chore. */
export function toChoreResponse(chore: ChoreWithPeople): ChoreResponse {
  return {
    id: chore.id,
    name: chore.name,
    notes: chore.notes,
    dueDate: chore.dueDate.toISOString().slice(0, 10),
    assignee: toPerson(chore.assignee),
    createdBy: toPerson(chore.createdBy),
    createdAt: chore.createdAt.toISOString(),
    completedAt: chore.completedAt ? chore.completedAt.toISOString() : null,
    completedBy: toPerson(chore.completedBy),
  };
}

/** A route parameter as a string (Express types allow arrays for some paths). */
function param(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

/** GET /api/chores?since=YYYY-MM-DD: 200 with chores not done, plus those done or due since then. */
export const list: RequestHandler = async (req, res) => {
  const since = typeof req.query.since === "string" ? req.query.since : undefined;
  const chores = await listChores(currentMembership(res), since);
  const body: ChoreListResponse = { chores: chores.map(toChoreResponse) };
  res.status(HttpStatus.OK).json(body);
};

/** POST /api/chores { name, assigneeId, dueDate, notes? }: 201 with the chore and its Location. */
export const create: RequestHandler = async (req, res) => {
  const chore = await addChore(currentMembership(res), {
    name: bodyText(req, "name"),
    assigneeId: bodyText(req, "assigneeId"),
    dueDate: bodyText(req, "dueDate"),
    notes: req.body?.notes,
  });
  res.status(HttpStatus.CREATED).location(`/api/chores/${chore.id}`).json(toChoreResponse(chore));
};

/** GET /api/chores/:id: 200 with one of the household's chores. */
export const show: RequestHandler = async (req, res) => {
  const chore = await getChore(currentMembership(res), param(req.params.id));
  res.status(HttpStatus.OK).json(toChoreResponse(chore));
};

/** POST /api/chores/:id/complete: 200 with the chore, now done (assignee only). */
export const complete: RequestHandler = async (req, res) => {
  const chore = await completeChore(currentMembership(res), param(req.params.id));
  res.status(HttpStatus.OK).json(toChoreResponse(chore));
};

/** DELETE /api/chores/:id/complete: 200 with the chore, no longer done (assignee only). */
export const undo: RequestHandler = async (req, res) => {
  const chore = await undoChore(currentMembership(res), param(req.params.id));
  res.status(HttpStatus.OK).json(toChoreResponse(chore));
};
