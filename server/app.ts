import express from "express";
import { handleError, sendError } from "./http.js";
import { healthRouter } from "./routes/health.js";

/**
 * Builds the Express app. Never calls listen: Vercel runs it as a Function
 * (api/index.ts) and server/dev.ts listens locally.
 */
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use("/api", healthRouter);

  app.use((req, res) => {
    sendError(res, 404, "NOT_FOUND", `No route for ${req.method} ${req.originalUrl}`);
  });
  app.use(handleError);

  return app;
}
