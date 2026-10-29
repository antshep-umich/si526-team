import express from "express";
import { health } from "../controllers/health.js";
import { methodNotAllowed } from "../middleware/errors.js";

// Mounted at /api.
export const healthRouter = express.Router();

healthRouter.route("/health").get(health).all(methodNotAllowed);
