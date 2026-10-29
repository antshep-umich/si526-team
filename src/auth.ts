import { createAuthClient } from "better-auth/react";

// Talks to Better Auth's routes at /api/auth on the same site, so the session
// cookie is sent automatically. No baseURL needed: the app and API share an origin.
export const authClient = createAuthClient();
