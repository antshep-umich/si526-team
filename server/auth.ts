import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import type { RequestHandler } from "express";
import { passwordMeetsRules, userNameMeetsRules } from "../shared/accounts.js";
import { getPrisma } from "./db.js";
import type { SessionResolver } from "./middleware/session.js";

// Sign-in with Better Auth (TECH_SPEC sections 2 and 7). It runs inside our Express app
// and keeps its users and sessions in our Postgres (the user, session, account and
// verification tables in prisma/schema.prisma).

// Better Auth works out its own URL from each request's Host header, but only accepts
// these hosts. Vercel serves every deployment at si526-team-<id>-si-526.vercel.app and
// every git branch at si526-team-git-<branch>-si-526.vercel.app, so previews need a
// wildcard. The -si-526 suffix is our Vercel team, so other teams' projects don't match.
const PRODUCTION_URL = "https://si526-team.vercel.app";
const VERCEL_HOSTS = [
  "si526-team.vercel.app",
  "si526-team-si-526.vercel.app",
  "si526-team-*-si-526.vercel.app",
];
// Locally the browser talks to Vite (5173), which forwards /api to Express.
const LOCAL_HOSTS = ["localhost:*", "127.0.0.1:*"];

/**
 * SCRUM-2's sign-up rules that Better Auth doesn't have: a name of 30 characters or
 * fewer, and a password with at least 1 number. The sign-up screen checks them too;
 * this stops anyone skipping the screen. Returns the error to send, or null.
 */
export function signUpRuleError(body: unknown): { code: string; message: string } | null {
  const { name, password } = (body ?? {}) as { name?: unknown; password?: unknown };
  if (typeof name !== "string" || !userNameMeetsRules(name)) {
    return { code: "NAME_INVALID", message: "Name must be 30 characters or fewer." };
  }
  if (typeof password !== "string" || !passwordMeetsRules(password)) {
    return { code: "PASSWORD_INVALID", message: "Password must be at least 8 characters long and include 1 number." };
  }
  return null;
}

function createAuth() {
  const onVercel = Boolean(process.env.VERCEL);
  return betterAuth({
    // Signs session cookies. Better Auth refuses to start in production without it.
    secret: process.env.BETTER_AUTH_SECRET,
    database: prismaAdapter(getPrisma(), { provider: "postgresql" }),
    // No email in the MVP (TECH_SPEC section 8), so addresses aren't verified.
    emailAndPassword: { enabled: true },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        const error = signUpRuleError(ctx.body);
        if (error) throw new APIError("BAD_REQUEST", error);
      }),
    },
    baseURL: {
      allowedHosts: onVercel ? VERCEL_HOSTS : LOCAL_HOSTS,
      protocol: onVercel ? "https" : "http",
      fallback: onVercel ? PRODUCTION_URL : "http://localhost:5173",
    },
  });
}

let auth: ReturnType<typeof createAuth> | undefined;
let handler: ReturnType<typeof toNodeHandler> | undefined;

/**
 * The one Better Auth instance. Created on first use, like the Prisma client, so a
 * missing setting becomes a request error instead of crashing the Function at load.
 */
export function getAuth() {
  auth ??= createAuth();
  return auth;
}

/** Better Auth's own routes (sign up, sign in, sign out, session). Mounted at /api/auth. */
export const authHandler: RequestHandler = (req, res) => {
  handler ??= toNodeHandler(getAuth());
  return handler(req, res);
};

/** The signed-in user, from Better Auth's session cookie. */
export const betterAuthSession: SessionResolver = async (req) => {
  const session = await getAuth().api.getSession({ headers: fromNodeHeaders(req.headers) });
  return session ? { id: session.user.id } : null;
};
