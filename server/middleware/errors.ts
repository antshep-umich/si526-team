import type { ErrorRequestHandler, RequestHandler, Response } from "express";
import { apiError } from "../../shared/api.js";
import { ServiceError, type ServiceErrorCode } from "../services/errors.js";

/** Sends an error in the format every API route uses (TECH_SPEC section 6). */
export function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json(apiError(code, message));
}

/** The HTTP status for each rule a service can report as broken. */
const STATUS_BY_CODE: Record<ServiceErrorCode, number> = {
  VALIDATION_ERROR: 400,
  PASSWORD_LENGTH: 400,
  FORBIDDEN: 403,
  NO_HOUSEHOLD: 404,
  INVITE_CODE_NOT_FOUND: 404,
  ACCOUNT_NOT_FOUND: 404,
  ALREADY_IN_HOUSEHOLD: 409,
};

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

/** After every route: a request that matched no route gets a JSON 404. */
export const notFound: RequestHandler = (req, res) => {
  sendError(res, 404, "NOT_FOUND", `No route for ${req.method} ${req.originalUrl}`);
};

/** Last middleware in the app: turns any error into a JSON response without exposing internals. */
export const handleError: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof ServiceError) {
    sendError(res, STATUS_BY_CODE[err.code], err.code, err.message);
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
