import express from "express";
import * as households from "../controllers/households.js";
import { methodNotAllowed } from "../middleware/errors.js";
import { requireHousehold } from "../middleware/household.js";

// Mounted at /api/households behind requireUser (server/app.ts).
//
// Authorization: no route takes a household id. "current" always means the
// household the signed-in user belongs to (requireHousehold), so there is no id to guess.
export const householdsRouter = express.Router();

// Each path ends in methodNotAllowed: other methods get 405 with an Allow header.
householdsRouter.route("/").post(households.create).all(methodNotAllowed);
householdsRouter.route("/join").post(households.join).all(methodNotAllowed);
householdsRouter.route("/current").get(requireHousehold, households.current).all(methodNotAllowed);
householdsRouter
  .route("/current/invite-code")
  .post(requireHousehold, households.newInviteCode)
  .all(methodNotAllowed);
