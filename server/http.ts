import type { ErrorRequestHandler, Response } from "express";
import { apiError } from "../shared/api.js";

/** Sends an error in the format every API route uses (TECH_SPEC section 6). */
export function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json(apiError(code, message));
}

function isJsonParseError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "type" in err && err.type === "entity.parse.failed";
}

/** Last middleware in the app: turns any error into a JSON response without exposing internals. */
export const handleError: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (isJsonParseError(err)) {
    sendError(res, 400, "INVALID_JSON", "Request body is not valid JSON");
    return;
  }
  console.error(err);
  sendError(res, 500, "INTERNAL_ERROR", "Something went wrong");
};
