import express, { type RequestHandler } from "express";
import { authHandler, betterAuthSession } from "./auth.js";
import { handleError, sendError } from "./http.js";
import { healthRouter } from "./routes/health.js";
import { householdsRouter } from "./routes/households.js";
import { requireUser, type SessionResolver } from "./session.js";

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
  app.use("/api/households", requireUser(options.getSessionUser ?? betterAuthSession), householdsRouter);

  app.use((req, res) => {
    sendError(res, 404, "NOT_FOUND", `No route for ${req.method} ${req.originalUrl}`);
  });
  app.use(handleError);

  return app;
}
