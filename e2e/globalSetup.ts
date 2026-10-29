import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import type { TestProject } from "vitest/node";
import { AUTH_PACING_FILE } from "./pacing.js";

// Runs once before the e2e tests. Two ways to run them:
//   npm run test:e2e                          local: uses (or starts) `npm run dev` and the dev database
//   E2E_BASE_URL=https://… npm run test:e2e   a deployment, for example a Vercel preview
// Locally it also deletes the accounts the tests made (emails ending @e2e.test) afterwards.

declare module "vitest" {
  export interface ProvidedContext {
    baseURL: string;
    /** True when testing a deployment rather than the local dev server. */
    remote: boolean;
  }
}

const LOCAL_URL = "http://localhost:5173";
export const E2E_EMAIL_DOMAIN = "@e2e.test";

async function isUp(baseURL: string): Promise<boolean> {
  try {
    return (await fetch(`${baseURL}/api/health`)).ok;
  } catch {
    return false;
  }
}

async function waitUntilUp(baseURL: string, seconds: number): Promise<boolean> {
  for (let i = 0; i < seconds; i++) {
    if (await isUp(baseURL)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

function stopServer(server: ChildProcess) {
  if (!server.pid) return;
  // `npm run dev` starts Vite and the API as child processes, so stop the whole tree.
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"]);
  else process.kill(-server.pid, "SIGTERM");
}

/** Deletes the e2e accounts, and households that only e2e accounts belonged to. */
async function deleteE2eData() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const { getPrisma } = await import("../server/db.js");
  const prisma = getPrisma();
  try {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: E2E_EMAIL_DOMAIN } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    const memberships = await prisma.membership.findMany({
      where: { userId: { in: ids } },
      select: { householdId: true },
    });
    for (const householdId of new Set(memberships.map((m) => m.householdId))) {
      const others = await prisma.membership.count({ where: { householdId, userId: { notIn: ids } } });
      if (others === 0) await prisma.household.delete({ where: { id: householdId } });
    }
    // Sessions, sign-in accounts and memberships go with their user (onDelete: Cascade).
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  } finally {
    await prisma.$disconnect();
  }
}

export default async function setup(project: TestProject) {
  const remoteURL = process.env.E2E_BASE_URL?.replace(/\/+$/, "");
  const baseURL = remoteURL ?? LOCAL_URL;
  project.provide("baseURL", baseURL);
  project.provide("remote", Boolean(remoteURL));
  // Start as if 3 sign-ins just happened, in case a previous run ended moments ago.
  if (remoteURL) writeFileSync(AUTH_PACING_FILE, JSON.stringify({ count: 3, last: Date.now() }));

  let server: ChildProcess | undefined;
  if (!remoteURL && !(await isUp(LOCAL_URL))) {
    server = spawn("npm run dev", {
      shell: true,
      stdio: "ignore",
      detached: process.platform !== "win32",
    });
  }
  if (!(await waitUntilUp(baseURL, 90))) {
    if (server) stopServer(server);
    throw new Error(`The app isn't answering at ${baseURL}/api/health`);
  }

  return async () => {
    rmSync(AUTH_PACING_FILE, { force: true });
    if (!remoteURL) await deleteE2eData();
    if (server) stopServer(server);
  };
}
