import express from "express";
import { handleError, sendError } from "./http.js";
import { healthRouter } from "./routes/health.js";
import { householdsRouter } from "./routes/households.js";
import { noSession, requireUser, type SessionResolver } from "./session.js";

export interface AppOptions {
  /** Works out who is making a request. Defaults to "nobody" until Spike 2 adds Better Auth. */
  getSessionUser?: SessionResolver;
}

/**
 * Builds the Express app. Never calls listen: Vercel runs it as a Function
 * (api/index.ts) and server/dev.ts listens locally.
 */
export function createApp(options: AppOptions = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use("/api", healthRouter);
  app.use("/api/households", requireUser(options.getSessionUser ?? noSession), householdsRouter);

  app.use((req, res) => {
    sendError(res, 404, "NOT_FOUND", `No route for ${req.method} ${req.originalUrl}`);
  });
  app.use(handleError);

  return app;
}
