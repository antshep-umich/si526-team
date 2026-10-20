import express from "express";
import * as passwordReset from "../controllers/passwordReset.js";
import { methodNotAllowed } from "../middleware/errors.js";

// Mounted at /api/password-reset. No session needed: it's for people who can't sign in.
export const passwordResetRouter = express.Router();

passwordResetRouter.route("/").post(passwordReset.reset).all(methodNotAllowed);
