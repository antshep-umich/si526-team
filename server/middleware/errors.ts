import type { ErrorRequestHandler, RequestHandler, Response } from "express";
import { apiError } from "../../shared/api.js";
import { HttpStatus } from "../../shared/httpStatus.js";
import { ServiceError, type ServiceErrorCode } from "../services/errors.js";

/** Sends an error in the format every API route uses (TECH_SPEC section 6). */
export function sendError(res: Response, status: HttpStatus, code: string, message: string): void {
  res.status(status).json(apiError(code, message));
}

/** The HTTP status for each rule a service can report as broken (TECH_SPEC section 6). */
const STATUS_BY_CODE: Record<ServiceErrorCode, HttpStatus> = {
  // Well-formed JSON whose values break a rule, including values that point at
  // nothing (an unknown invite code or email): the endpoint exists, the input doesn't fit.
  VALIDATION_ERROR: HttpStatus.UNPROCESSABLE_CONTENT,
  PASSWORD_LENGTH: HttpStatus.UNPROCESSABLE_CONTENT,
  INVITE_CODE_NOT_FOUND: HttpStatus.UNPROCESSABLE_CONTENT,
  ACCOUNT_NOT_FOUND: HttpStatus.UNPROCESSABLE_CONTENT,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  // The URL names "your household", and there isn't one.
  NO_HOUSEHOLD: HttpStatus.NOT_FOUND,
  ALREADY_IN_HOUSEHOLD: HttpStatus.CONFLICT,
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

/**
 * For a path that exists but not with this method (use as `router.route(path).get(…).all(methodNotAllowed)`):
 * answers 405 with an Allow header listing the methods the path does take.
 */
export const methodNotAllowed: RequestHandler = (req, res) => {
  const registered = (req.route as { methods?: Record<string, boolean> } | undefined)?.methods ?? {};
  const allowed = Object.keys(registered)
    .filter((method) => method !== "_all")
    .map((method) => method.toUpperCase());
  if (allowed.includes("GET") && !allowed.includes("HEAD")) allowed.push("HEAD");
  res.set("Allow", allowed.join(", "));
  sendError(res, HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED", `${req.method} isn't allowed here. Use ${allowed.join(" or ")}.`);
};

/** After every route: a request that matched no route gets a JSON 404. */
export const notFound: RequestHandler = (req, res) => {
  sendError(res, HttpStatus.NOT_FOUND, "NOT_FOUND", `No route for ${req.method} ${req.originalUrl}`);
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
    sendError(res, HttpStatus.BAD_REQUEST, "INVALID_JSON", "Request body is not valid JSON");
    return;
  }
  const status = clientErrorStatus(err);
  if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
    sendError(res, HttpStatus.PAYLOAD_TOO_LARGE, "PAYLOAD_TOO_LARGE", "Request body is too large");
    return;
  }
  if (status === HttpStatus.UNSUPPORTED_MEDIA_TYPE) {
    sendError(res, HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE", "Request body encoding is not supported");
    return;
  }
  if (status !== undefined) {
    sendError(res, HttpStatus.BAD_REQUEST, "BAD_REQUEST", "Request could not be processed");
    return;
  }
  console.error(err);
  sendError(res, HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Something went wrong");
};
