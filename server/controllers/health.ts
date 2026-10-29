import type { RequestHandler } from "express";
import type { HealthResponse } from "../../shared/api.js";
import { HttpStatus } from "../../shared/httpStatus.js";
import { sendError } from "../middleware/errors.js";
import { checkDatabase } from "../services/health.js";

/** GET /api/health: uptime check (TECH_SPEC section 6). 503 if the database check fails. */
export const health: RequestHandler = async (_req, res) => {
  try {
    await checkDatabase();
  } catch (err) {
    console.error("Health check failed", err);
    sendError(res, HttpStatus.SERVICE_UNAVAILABLE, "DATABASE_UNAVAILABLE", "Database check failed");
    return;
  }
  const body: HealthResponse = { status: "ok", database: "ok" };
  res.status(HttpStatus.OK).json(body);
};
