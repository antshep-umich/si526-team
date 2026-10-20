import type { RequestHandler } from "express";
import { HttpStatus } from "../../shared/httpStatus.js";
import { resetPassword } from "../services/passwordReset.js";
import { bodyText } from "./body.js";

/** POST /api/password-reset { email, newPassword }: 204 when done. STAND-IN, see services/passwordReset.ts. */
export const reset: RequestHandler = async (req, res) => {
  await resetPassword(bodyText(req, "email"), bodyText(req, "newPassword"));
  res.status(HttpStatus.NO_CONTENT).end();
};
