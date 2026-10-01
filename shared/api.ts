// Types shared by the React app and the API. Zod schemas join these once the team confirms Zod.

/** Shape of every API error response (TECH_SPEC section 6). */
export interface ApiError {
  error: { code: string; message: string };
}

/** Body of a successful GET /api/health. */
export interface HealthResponse {
  status: "ok";
  database: "ok";
}

/** Builds an error body in the shared format. */
export function apiError(code: string, message: string): ApiError {
  return { error: { code, message } };
}
