import express from "express";
import type { HouseholdResponse } from "../../shared/api.js";
import { currentMembership, requireHousehold } from "../middleware/household.js";
import { currentUser } from "../middleware/session.js";
import {
  createHousehold,
  getHousehold,
  joinHousehold,
  regenerateInviteCode,
  type HouseholdWithMembers,
} from "../services/households.js";
import { bodyText } from "./body.js";

// Household routes (TECH_SPEC section 6). Mounted at /api/households behind
// requireUser, so every handler has a signed-in user. The rules live in
// services/households.ts; these handlers only translate HTTP to and from it.
//
// Authorization: no route takes a household id. "current" always means the
// household the signed-in user belongs to, so there is no id to guess.
export const householdsRouter = express.Router();

/** The API shape of a household, as seen by `userId`. */
function toHouseholdResponse(household: HouseholdWithMembers, userId: string): HouseholdResponse {
  const mine = household.memberships.find((m) => m.userId === userId);
  if (!mine) throw new Error("User is not a member of the household being returned");
  return {
    id: household.id,
    name: household.name,
    inviteCode: household.inviteCode,
    createdAt: household.createdAt.toISOString(),
    role: mine.role,
    members: household.memberships.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
  };
}

// Create a household. The creator becomes its owner.
householdsRouter.post("/", async (req, res) => {
  const userId = currentUser(res).id;
  const household = await createHousehold(userId, bodyText(req, "name"));
  res.status(201).json(toHouseholdResponse(household, userId));
});

// Join a household with its invite code.
householdsRouter.post("/join", async (req, res) => {
  const userId = currentUser(res).id;
  const household = await joinHousehold(userId, bodyText(req, "inviteCode"));
  res.json(toHouseholdResponse(household, userId));
});

// The signed-in user's household and its members.
householdsRouter.get("/current", requireHousehold, async (_req, res) => {
  const membership = currentMembership(res);
  const household = await getHousehold(membership.householdId);
  res.json(toHouseholdResponse(household, membership.userId));
});

// Replace the invite code (owner only). The old code stops working immediately.
householdsRouter.post("/current/invite-code", requireHousehold, async (_req, res) => {
  const membership = currentMembership(res);
  const household = await regenerateInviteCode(membership);
  res.json(toHouseholdResponse(household, membership.userId));
});
