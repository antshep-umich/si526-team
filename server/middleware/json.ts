import type { Request, RequestHandler } from "express";
import { HttpStatus } from "../../shared/httpStatus.js";
import { sendError } from "./errors.js";

/** True if the request carries body bytes. (Content-Length: 0 counts as no body.) */
function hasBody(req: Request): boolean {
  if (req.get("transfer-encoding") !== undefined) return true;
  const length = Number(req.get("content-length"));
  return Number.isFinite(length) && length > 0;
}

/**
 * For routes that read JSON bodies (mounted after express.json, and after
 * requireUser so signed-out requests get 401 first): a request that carries a
 * body must send it as JSON, or it gets 415 instead of being treated as empty.
 * Requests without a body pass through.
 */
export const requireJsonBody: RequestHandler = (req, res, next) => {
  if (hasBody(req) && !req.is("application/json")) {
    sendError(
      res,
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      "UNSUPPORTED_MEDIA_TYPE",
      "Send the request body as JSON (Content-Type: application/json)",
    );
    return;
  }
  next();
};
