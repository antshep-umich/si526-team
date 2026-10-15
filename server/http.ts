import type { ErrorRequestHandler, Response } from "express";
import { apiError } from "../shared/api.js";

/** Sends an error in the format every API route uses (TECH_SPEC section 6). */
export function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json(apiError(code, message));
}

function isJsonParseError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "type" in err && err.type === "entity.parse.failed";
}

/** The 4xx status a body parser attached to a bad request, if any. */
function clientErrorStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  if (!("expose" in err) || err.expose !== true) return undefined;
  if (!("status" in err) || typeof err.status !== "number") return undefined;
  return err.status >= 400 && err.status < 500 ? err.status : undefined;
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
  const status = clientErrorStatus(err);
  if (status === 413) {
    sendError(res, 413, "PAYLOAD_TOO_LARGE", "Request body is too large");
    return;
  }
  if (status === 415) {
    sendError(res, 415, "UNSUPPORTED_MEDIA_TYPE", "Request body encoding is not supported");
    return;
  }
  if (status !== undefined) {
    sendError(res, status, "BAD_REQUEST", "Request could not be processed");
    return;
  }
  console.error(err);
  sendError(res, 500, "INTERNAL_ERROR", "Something went wrong");
};
