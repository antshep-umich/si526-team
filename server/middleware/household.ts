import type { RequestHandler, Response } from "express";
import { ServiceError } from "../services/errors.js";
import { findMembership, type Membership } from "../services/households.js";
import { currentUser } from "./session.js";

/**
 * For routes about the signed-in user's own household. Mount after requireUser.
 * Answers 404 NO_HOUSEHOLD if they haven't joined one; otherwise stores their
 * membership for `currentMembership`.
 *
 * Authorization rule (TECH_SPEC section 6): routes behind this read and write
 * only `currentMembership(res).householdId`, never a household id from the request.
 */
export const requireHousehold: RequestHandler = async (_req, res, next) => {
  const membership = await findMembership(currentUser(res).id);
  if (!membership) throw new ServiceError("NO_HOUSEHOLD", "You don't belong to a household yet");
  res.locals.membership = membership;
  next();
};

/** The membership `requireHousehold` found. Only call from routes mounted behind it. */
export function currentMembership(res: Response): Membership {
  const membership = res.locals.membership as Membership | undefined;
  if (!membership) throw new Error("currentMembership called on a route without requireHousehold");
  return membership;
}
