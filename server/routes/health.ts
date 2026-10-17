import express from "express";
import type { HealthResponse } from "../../shared/api.js";
import { sendError } from "../middleware/errors.js";
import { checkDatabase } from "../services/health.js";

export const healthRouter = express.Router();

// Uptime check (TECH_SPEC section 6). Fails if the database is unreachable or
// migrations haven't run.
healthRouter.get("/health", async (_req, res) => {
  try {
    await checkDatabase();
  } catch (err) {
    console.error("Health check failed", err);
    sendError(res, 503, "DATABASE_UNAVAILABLE", "Database check failed");
    return;
  }
  const body: HealthResponse = { status: "ok", database: "ok" };
  res.json(body);
});
