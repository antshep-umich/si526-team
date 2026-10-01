import express from "express";
import type { HealthResponse } from "../../shared/api.js";
import { getPrisma } from "../db.js";
import { sendError } from "../http.js";

export const healthRouter = express.Router();

// Uptime check (TECH_SPEC section 6). Reads the Household table, so it fails if
// the database is unreachable or migrations haven't run.
healthRouter.get("/health", async (_req, res) => {
  try {
    await getPrisma().household.findFirst({ select: { id: true } });
  } catch (err) {
    console.error("Health check failed", err);
    sendError(res, 503, "DATABASE_UNAVAILABLE", "Database check failed");
    return;
  }
  const body: HealthResponse = { status: "ok", database: "ok" };
  res.json(body);
});
