// Local development only: Vercel imports the app from api/index.ts instead.
import { createApp } from "./app.js";
import type { SessionResolver } from "./session.js";

// Stand-in for signing in until Spike 2: send an `x-dev-user-id` header, or set
// DEV_USER_ID in .env. This file never runs on Vercel, so it can't reach a deployment.
const devSession: SessionResolver = (req) => {
  const id = req.get("x-dev-user-id") ?? process.env.DEV_USER_ID;
  return id ? { id } : null;
};

const port = Number(process.env.PORT ?? 3000);

createApp({ getSessionUser: devSession }).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
