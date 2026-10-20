import express, { type RequestHandler } from "express";
import { authHandler, betterAuthSession } from "./auth.js";
import { handleError, notFound } from "./middleware/errors.js";
import { requireJsonBody } from "./middleware/json.js";
import { requireUser, type SessionResolver } from "./middleware/session.js";
import { healthRouter } from "./routes/health.js";
import { householdsRouter } from "./routes/households.js";
import { passwordResetRouter } from "./routes/passwordReset.js";

// Layers, in the order a request passes through them (TECH_SPEC section 3):
//   middleware/   shared request handling: sessions, households, errors
//   routes/       URL + middleware → controller, nothing else
//   controllers/  read the request, call a service, shape and send the response
//   services/     the app's rules; no Express or Prisma, so other callers can reuse them
//   models/       the only code that reads or writes the database
//   db.ts         the Prisma client (tables in prisma/schema.prisma)

export interface AppOptions {
  /** Works out who is making a request. Defaults to Better Auth's session cookie. */
  getSessionUser?: SessionResolver;
  /** Handles /api/auth/*. Defaults to Better Auth. */
  authHandler?: RequestHandler;
}

/**
 * Builds the Express app. Never calls listen: Vercel runs it as a Function
 * (api/index.ts) and server/dev.ts listens locally.
 */
export function createApp(options: AppOptions = {}) {
  const app = express();
  app.disable("x-powered-by");
  // Before express.json(): Better Auth reads the request body itself.
  app.all("/api/auth/*splat", options.authHandler ?? authHandler);
  app.use(express.json());
  app.use("/api", healthRouter);
  app.use("/api/password-reset", requireJsonBody, passwordResetRouter);
  app.use(
    "/api/households",
    requireUser(options.getSessionUser ?? betterAuthSession),
    requireJsonBody,
    householdsRouter,
  );

  app.use(notFound);
  app.use(handleError);

  return app;
}
