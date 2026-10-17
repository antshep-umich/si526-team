import express from "express";
import { resetPassword } from "../services/passwordReset.js";
import { bodyText } from "./body.js";

// STAND-IN "Forgot your password?" (see services/passwordReset.ts and TECH_DEBT.md #7).
export const passwordResetRouter = express.Router();

// Set a new password: { email, newPassword }. Signs the account out everywhere.
passwordResetRouter.post("/", async (req, res) => {
  await resetPassword(bodyText(req, "email"), bodyText(req, "newPassword"));
  res.status(204).end();
});
