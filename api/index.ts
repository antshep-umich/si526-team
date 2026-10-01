// Vercel Function entry. vercel.json rewrites every /api/* request here; Express routes it.
import { createApp } from "../server/app.js";

export default createApp();
