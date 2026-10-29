import express from "express";
import * as chores from "../controllers/chores.js";
import { methodNotAllowed } from "../middleware/errors.js";
import { requireHousehold } from "../middleware/household.js";

// Mounted at /api/chores behind requireUser and requireJsonBody (server/app.ts).
//
// Authorization: every route needs a household, and a chore id from the URL is only
// looked up inside that household, so another household's chore is simply not found.
export const choresRouter = express.Router();

choresRouter.use(requireHousehold);

// Each path ends in methodNotAllowed: other methods get 405 with an Allow header.
choresRouter.route("/").get(chores.list).post(chores.create).all(methodNotAllowed);
choresRouter.route("/:id").get(chores.show).all(methodNotAllowed);
choresRouter.route("/:id/complete").post(chores.complete).delete(chores.undo).all(methodNotAllowed);
