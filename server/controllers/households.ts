import type { RequestHandler } from "express";
import type { HouseholdNoticesResponse, HouseholdResponse } from "../../shared/api.js";
import type { ChoreType } from "../../shared/preferences.js";
import { HttpStatus } from "../../shared/httpStatus.js";
import { currentMembership } from "../middleware/household.js";
import { currentUser } from "../middleware/session.js";
import {
  createHousehold,
  getHousehold,
  joinHousehold,
  leaveHousehold,
  regenerateInviteCode,
  type HouseholdWithMembers,
} from "../services/households.js";
import { markNoticesSeen, unseenNotices } from "../services/notices.js";
import { chorePreferencesOf, saveAssignmentMethod, saveChorePreferences } from "../services/preferences.js";
import { bodyText } from "./body.js";

// Household endpoints (TECH_SPEC section 6): read the request, call the service,
// send the household back. Rule errors from the service become HTTP errors in
// middleware/errors.ts.

/** Where the signed-in user's household lives, for the Location header after create or join. */
const CURRENT_HOUSEHOLD_URL = "/api/households/current";

/** The API shape of a household, as seen by `userId`. */
export function toHouseholdResponse(household: HouseholdWithMembers, userId: string): HouseholdResponse {
  const mine = household.memberships.find((m) => m.userId === userId);
  if (!mine) throw new Error("User is not a member of the household being returned");
  return {
    id: household.id,
    name: household.name,
    inviteCode: household.inviteCode,
    createdAt: household.createdAt.toISOString(),
    role: mine.role,
    assignmentMethod: household.assignmentMethod,
    members: household.memberships.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      // Only CHORE_TYPES ids are ever saved (parseChorePreferences).
      choreTypes: m.choreTypes as ChoreType[],
    })),
  };
}

/** POST /api/households { name }: 201, and the creator becomes the owner. */
export const create: RequestHandler = async (req, res) => {
  const userId = currentUser(res).id;
  const household = await createHousehold(userId, bodyText(req, "name"));
  res.status(HttpStatus.CREATED).location(CURRENT_HOUSEHOLD_URL).json(toHouseholdResponse(household, userId));
};

/** POST /api/households/join { inviteCode }: 201 when it adds the user, 200 if they were already in. */
export const join: RequestHandler = async (req, res) => {
  const userId = currentUser(res).id;
  const { household, joined } = await joinHousehold(userId, bodyText(req, "inviteCode"));
  if (joined) res.status(HttpStatus.CREATED).location(CURRENT_HOUSEHOLD_URL);
  else res.status(HttpStatus.OK);
  res.json(toHouseholdResponse(household, userId));
};

/** GET /api/households/current: 200 with the signed-in user's household and its members. */
export const current: RequestHandler = async (_req, res) => {
  const membership = currentMembership(res);
  const household = await getHousehold(membership.householdId);
  res.status(HttpStatus.OK).json(toHouseholdResponse(household, membership.userId));
};

/** POST /api/households/current/invite-code: 200 with the new code (owner only); the old code stops working. */
export const newInviteCode: RequestHandler = async (_req, res) => {
  const membership = currentMembership(res);
  const household = await regenerateInviteCode(membership);
  res.status(HttpStatus.OK).json(toHouseholdResponse(household, membership.userId));
};

/** GET /api/households/current/preferences: 200 with the signed-in member's chore preferences (SCRUM-72). */
export const preferences: RequestHandler = (_req, res) => {
  res.status(HttpStatus.OK).json(chorePreferencesOf(currentMembership(res)));
};

/** PUT /api/households/current/preferences { choreTypes, weeklyWorkload }: 200 with what was saved. */
export const savePreferences: RequestHandler = async (req, res) => {
  const saved = await saveChorePreferences(currentMembership(res), req.body);
  res.status(HttpStatus.OK).json(saved);
};

/** PUT /api/households/current/assignment-method { assignmentMethod }: 200 with the household (owner only). */
export const assignmentMethod: RequestHandler = async (req, res) => {
  const membership = currentMembership(res);
  const household = await saveAssignmentMethod(membership, bodyText(req, "assignmentMethod"));
  res.status(HttpStatus.OK).json(toHouseholdResponse(household, membership.userId));
};

/** DELETE /api/households/current/membership: 204; the user has left the household (SCRUM-75). */
export const leave: RequestHandler = async (_req, res) => {
  await leaveHousehold(currentMembership(res));
  res.status(HttpStatus.NO_CONTENT).end();
};

/** GET /api/households/current/notices: 200 with the notices the user hasn't seen (SCRUM-75 AC8). */
export const notices: RequestHandler = async (_req, res) => {
  const found = await unseenNotices(currentMembership(res));
  const body: HouseholdNoticesResponse = {
    notices: found.map((n) => ({ id: n.id, kind: n.kind, personName: n.personName, createdAt: n.createdAt.toISOString() })),
  };
  res.status(HttpStatus.OK).json(body);
};

/** PUT /api/households/current/notices/seen { through }: 204; notices up to then won't come back. */
export const noticesSeen: RequestHandler = async (req, res) => {
  await markNoticesSeen(currentMembership(res), req.body?.through);
  res.status(HttpStatus.NO_CONTENT).end();
};
