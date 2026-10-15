import type { Request, RequestHandler, Response } from "express";
import { sendError } from "./http.js";

/** The signed-in user, as far as our routes care. */
export interface SessionUser {
  id: string;
}

/**
 * Works out who is making a request, or null if nobody is signed in.
 * Spike 2 supplies the real one (Better Auth's getSession); tests and
 * server/dev.ts supply stand-ins.
 */
export type SessionResolver = (req: Request) => SessionUser | null | Promise<SessionUser | null>;

/** The default until Better Auth is wired in: every protected route answers 401. */
export const noSession: SessionResolver = () => null;

/** Rejects requests with no session; otherwise stores the user for `currentUser`. */
export function requireUser(resolve: SessionResolver): RequestHandler {
  return async (req, res, next) => {
    const user = await resolve(req);
    if (!user) {
      sendError(res, 401, "UNAUTHENTICATED", "Sign in to continue");
      return;
    }
    res.locals.user = user;
    next();
  };
}

/** The user `requireUser` found. Only call from routes mounted behind it. */
export function currentUser(res: Response): SessionUser {
  const user = res.locals.user as SessionUser | undefined;
  if (!user) throw new Error("currentUser called on a route without requireUser");
  return user;
}
