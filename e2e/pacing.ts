import { tmpdir } from "node:os";
import { join } from "node:path";

/** Shared by all e2e test files: when the last sign-in/sign-up requests were sent (helpers.ts). */
export const AUTH_PACING_FILE = join(tmpdir(), "si526-e2e-auth-pacing.json");
