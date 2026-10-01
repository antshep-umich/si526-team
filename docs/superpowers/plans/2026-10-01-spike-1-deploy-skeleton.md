# Spike 1: Deploy Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Vite + React + TypeScript page and an Express `/api/health` route that reads from Neon through Prisma, deployed to a Vercel preview, so the stack in TECH_SPEC section 3 is proven before feature work.

**Architecture:** One repo and one `package.json`. Express is built by `createApp()` in `server/app.ts`; `api/index.ts` exports it as a Vercel Function and `server/dev.ts` listens on port 3000 locally. Vite serves the React app on port 5173 and proxies `/api` to Express. Prisma 7 talks to Neon through the `pg` driver adapter: the app uses the pooled `DATABASE_URL`, the CLI uses the direct `DATABASE_URL_UNPOOLED`, and `prisma migrate deploy` runs in the Vercel build.

**Tech Stack:** Node 24, TypeScript ~6.0, Express 5, Vite 8, React 19, Prisma 7.10.0 with `@prisma/adapter-pg`, Vitest 5, Supertest 7, tsx, concurrently.

**Spec:** `TECH_SPEC.md` (sections 3, 5, 6, 7, 10, 12, 14).

## Global Constraints

- Node: `"engines": { "node": "24.x" }` and `@types/node@^24`. The Vercel project already runs Node 24.x. A local Node 26 is fine; npm prints an `EBADENGINE` warning, which is expected.
- Prisma packages pinned **exactly** to `7.10.0` (`prisma`, `@prisma/client`, `@prisma/adapter-pg`). npm's `latest` tag for `prisma` currently points to `8.0.0-rc.19`, a release candidate, so never install it unpinned.
- TypeScript strict mode on in every tsconfig.
- ESM throughout (`"type": "module"`). In `api/`, `server/` and `shared/`, relative imports end in **`.js`** (for example `import { createApp } from "../server/app.js"`). TypeScript resolves them to the `.ts` source, and Vercel's Node runtime compiles each `.ts` file to `.js`. The React code in `src/` keeps Vite's convention (`./App.tsx`, `../shared/api.ts`).
- Runtime uses `DATABASE_URL` (pooled). Prisma CLI and migrations use `DATABASE_URL_UNPOOLED` (direct). Local development uses the Neon `dev` branch through `.env`, never `main`.
- Error responses always use `{ "error": { "code": "...", "message": "..." } }` with the matching HTTP status (spec section 6).
- `server/app.ts` never calls `listen`. No in-memory state between requests and no timers (spec section 3).
- Out of scope: Better Auth, Zod, ESLint/Prettier (still *Proposed*), and any table other than `Household`.
- Git: work on branch `feat/spike-1-skeleton`, commit identity `antshep@umich.edu`, and merge via pull request only (spec section 13).

## Review Focus

1. **Unknown `/api/...` path** → a JSON 404 in the spec's error format, not Express's HTML page and not the React `index.html`. Pinned by Task 1's `app.test.ts`, re-checked on the preview in Task 4.
2. **Malformed JSON body or an unexpected exception** → JSON 400 or 500 with no stack trace or secrets in the body. Pinned by Task 1's `app.test.ts` and `http.test.ts`.
3. **Database unreachable, migration not applied, or an empty `Household` table** → `/api/health` gives 503 JSON on failure, and 200 when the table is merely empty. Pinned by Task 2's `health.test.ts`.
4. **`DATABASE_URL` missing**, for example a teammate without `.env` → the clear message "DATABASE_URL is not set" and a 503, instead of `pg` quietly trying `localhost`. Pinned by Task 2's `db.test.ts` and `health.test.ts`.
5. **Browser refresh on a client-side path such as `/chores` on Vercel** → serves `index.html`, not a 404. Only testable on a real deployment, so it's checked in Task 4.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | Scripts, dependencies, `engines`, `"type": "module"` |
| `tsconfig.json` | Root: project references only. Vercel's Node runtime also reads it; with no `compilerOptions` it defaults to `NodeNext` |
| `tsconfig.server.json` | Type-checks `api/`, `server/`, `shared/` (NodeNext) |
| `tsconfig.app.json` | Type-checks `src/` and `shared/` (bundler mode, React JSX) |
| `tsconfig.node.json` | Type-checks `vite.config.ts` and `prisma.config.ts` |
| `shared/api.ts` | Types shared by the React app and the API (`ApiError`, `HealthResponse`) |
| `server/http.ts` | `sendError()` and the final JSON error-handling middleware |
| `server/app.ts` | `createApp()`: JSON body parsing, routes, 404 and error handling |
| `server/db.ts` | `getPrisma()`: the single shared Prisma client, created on first use |
| `server/routes/health.ts` | `GET /api/health` |
| `server/dev.ts` | Local only: `createApp().listen(3000)` |
| `api/index.ts` | Vercel Function entry: `export default createApp()` |
| `prisma/schema.prisma` | Data model (`Household` only for this spike) |
| `prisma/migrations/` | Generated SQL migrations (committed) |
| `prisma.config.ts` | Prisma CLI config: schema path, migrations path, direct URL |
| `server/generated/prisma/` | Generated Prisma client (git-ignored, rebuilt by `postinstall` and the Vercel build) |
| `vite.config.ts` | React plugin and the `/api` → `localhost:3000` dev proxy |
| `index.html`, `src/main.tsx`, `src/App.tsx` | The React page that calls `/api/health` |
| `vercel.json` | Framework, build command, output directory and rewrites |

Tests sit next to the code: `server/app.test.ts`, `server/http.test.ts`, `server/db.test.ts`, `server/routes/health.test.ts`.

---

### Task 1: Tooling and Express app skeleton

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.server.json`, `shared/api.ts`, `server/http.ts`, `server/app.ts`
- Test: `server/app.test.ts`, `server/http.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `shared/api.ts`: `interface ApiError { error: { code: string; message: string } }`, `interface HealthResponse { status: "ok"; database: "ok" }` and `apiError(code: string, message: string): ApiError`
  - `server/http.ts`: `sendError(res: Response, status: number, code: string, message: string): void` and `handleError: ErrorRequestHandler`
  - `server/app.ts`: `createApp(): Express`. Later tasks add routers between `express.json()` and the 404 handler.

- [ ] **Step 1: Create the branch**

```bash
git checkout main && git pull
git checkout -b feat/spike-1-skeleton
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "si526-team",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "engines": {
    "node": "24.x"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -b"
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
npm install express
npm install -D typescript@~6.0.2 @types/node@^24 @types/express vitest supertest @types/supertest
```

Expected: `package-lock.json` created. An `EBADENGINE` warning on Node 26 is expected.

- [ ] **Step 4: Write `tsconfig.json` and `tsconfig.server.json`**

`tsconfig.json`:

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.server.json" }]
}
```

`tsconfig.server.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.server.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "nodenext",
    "types": ["node"],
    "skipLibCheck": true,
    "strict": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "erasableSyntaxOnly": true,
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["api", "server", "shared"]
}
```

- [ ] **Step 5: Write `shared/api.ts`**

```ts
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
```

`apiError` is the API's runtime import from `shared/`. Type-only imports are erased at compile time, so without it Task 4 couldn't prove that Vercel bundles code from `shared/` into the function.

- [ ] **Step 6: Write the failing tests**

`server/app.test.ts`:

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("createApp", () => {
  it("answers unknown API routes with a JSON 404", async () => {
    const res = await request(createApp()).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({
      error: { code: "NOT_FOUND", message: "No route for GET /api/does-not-exist" },
    });
  });

  it("answers a malformed JSON body with a JSON 400", async () => {
    const res = await request(createApp())
      .post("/api/anything")
      .set("Content-Type", "application/json")
      .send('{"title": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: "INVALID_JSON", message: "Request body is not valid JSON" },
    });
  });
});
```

`server/http.test.ts`:

```ts
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleError } from "./http.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleError", () => {
  it("turns an unexpected error into a JSON 500 without leaking details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const app = express();
    app.get("/boom", () => {
      throw new Error("secret connection string in stack");
    });
    app.use(handleError);

    const res = await request(app).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL. Both files report that `./app.js` and `./http.js` can't be resolved.

- [ ] **Step 8: Write `server/http.ts`**

```ts
import type { ErrorRequestHandler, Response } from "express";
import { apiError } from "../shared/api.js";

/** Sends an error in the format every API route uses (TECH_SPEC section 6). */
export function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json(apiError(code, message));
}

function isJsonParseError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "type" in err && err.type === "entity.parse.failed";
}

/** Last middleware in the app: turns any error into a JSON response without exposing internals. */
export const handleError: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (isJsonParseError(err)) {
    sendError(res, 400, "INVALID_JSON", "Request body is not valid JSON");
    return;
  }
  console.error(err);
  sendError(res, 500, "INTERNAL_ERROR", "Something went wrong");
};
```

- [ ] **Step 9: Write `server/app.ts`**

```ts
import express from "express";
import { handleError, sendError } from "./http.js";

/**
 * Builds the Express app. Never calls listen: Vercel runs it as a Function
 * (api/index.ts) and server/dev.ts listens locally.
 */
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());

  app.use((req, res) => {
    sendError(res, 404, "NOT_FOUND", `No route for ${req.method} ${req.originalUrl}`);
  });
  app.use(handleError);

  return app;
}
```

- [ ] **Step 10: Run the tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: 3 tests pass and `tsc -b` exits 0 with no output.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.server.json shared/api.ts server/app.ts server/http.ts server/app.test.ts server/http.test.ts docs/superpowers/plans/2026-10-01-spike-1-deploy-skeleton.md
git commit -m "Add Express app skeleton with JSON 404 and error handling"
```

---

### Task 2: Prisma, the Household table and `/api/health`

**Files:**
- Create: `prisma.config.ts`, `prisma/schema.prisma`, `prisma/migrations/*` (generated), `server/db.ts`, `server/routes/health.ts`, `server/dev.ts`
- Modify: `package.json` (scripts), `.gitignore`, `server/app.ts`
- Test: `server/db.test.ts`, `server/routes/health.test.ts`

**Interfaces:**
- Consumes: `createApp()`, `sendError()` and `HealthResponse` from Task 1.
- Produces:
  - `server/db.ts`: `getPrisma(): PrismaClient`. It throws `Error("DATABASE_URL is not set")` when the variable is empty or missing.
  - `server/routes/health.ts`: `healthRouter` (an `express.Router()`), mounted at `/api`.
  - `GET /api/health` → `200 { "status": "ok", "database": "ok" }` or `503 { "error": { "code": "DATABASE_UNAVAILABLE", "message": "Database check failed" } }`.

- [ ] **Step 1: Install Prisma, the driver adapter, dotenv and tsx**

```bash
npm install -E @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0
npm install -D -E prisma@7.10.0
npm install -D dotenv tsx
```

npm 11.19 prints `install-scripts` warnings for `prisma` and `@prisma/engines`. These are expected and harmless: generation and migrations work without those scripts (verified on 2026-10-01).

- [ ] **Step 2: Write `prisma.config.ts`**

```ts
// Prisma CLI config. Loads .env locally; on Vercel the Neon integration provides the variables.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Migrations need the direct (unpooled) connection. Read with process.env rather than
  // Prisma's env() helper so `prisma generate` still works where no database is configured.
  datasource: { url: process.env.DATABASE_URL_UNPOOLED },
});
```

- [ ] **Step 3: Write `prisma/schema.prisma`**

```prisma
// Data model: TECH_SPEC section 5. Better Auth's tables (user, session, ...) arrive in Spike 2.

generator client {
  provider            = "prisma-client"
  output              = "../server/generated/prisma"
  moduleFormat        = "esm"
  importFileExtension = "js"
}

datasource db {
  provider = "postgresql"
}

model Household {
  id         String   @id @default(uuid()) @db.Uuid
  name       String
  inviteCode String   @unique
  createdAt  DateTime @default(now())
}
```

- [ ] **Step 4: Ignore the generated client and add the `postinstall` script**

Append to `.gitignore`:

```
# generated Prisma client (rebuilt by postinstall and the Vercel build)
server/generated/
```

Set the `scripts` block in `package.json` to:

```json
  "scripts": {
    "postinstall": "prisma generate",
    "test": "vitest run",
    "typecheck": "tsc -b"
  }
```

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client (7.10.0) to ./server/generated/prisma`

- [ ] **Step 5: Write the failing tests**

`server/db.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "./db.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getPrisma", () => {
  it("fails with a clear message when DATABASE_URL is not set", () => {
    vi.stubEnv("DATABASE_URL", "");

    expect(() => getPrisma()).toThrow("DATABASE_URL is not set");
  });
});
```

`server/routes/health.test.ts`:

```ts
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";

const { findFirst, getPrisma } = vi.hoisted(() => {
  const findFirst = vi.fn();
  return { findFirst, getPrisma: vi.fn(() => ({ household: { findFirst } })) };
});
vi.mock("../db.js", () => ({ getPrisma }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/health", () => {
  it("reports ok when the database query succeeds, even with no households", async () => {
    findFirst.mockResolvedValueOnce(null);

    const res = await request(createApp()).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", database: "ok" });
    expect(findFirst).toHaveBeenCalledWith({ select: { id: true } });
  });

  it("answers 503 in the API error format when the database query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    findFirst.mockRejectedValueOnce(new Error('relation "Household" does not exist'));

    const res = await request(createApp()).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: { code: "DATABASE_UNAVAILABLE", message: "Database check failed" },
    });
  });

  it("answers 503 when the database is not configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getPrisma.mockImplementationOnce(() => {
      throw new Error("DATABASE_URL is not set");
    });

    const res = await request(createApp()).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("DATABASE_UNAVAILABLE");
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL. `db.test.ts` can't resolve `./db.js`. `health.test.ts` fails because `/api/health` returns the 404 from Task 1, not 200 or 503.

- [ ] **Step 7: Write `server/db.ts`**

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

let client: PrismaClient | undefined;

/**
 * The one shared Prisma client. Created on first use so a missing DATABASE_URL
 * becomes a request error instead of crashing the Function at load.
 * DATABASE_URL is Neon's pooled connection (TECH_SPEC section 7).
 */
export function getPrisma(): PrismaClient {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    client = new PrismaClient({
      adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 10_000 }),
    });
  }
  return client;
}
```

- [ ] **Step 8: Write `server/routes/health.ts`**

```ts
import express from "express";
import type { HealthResponse } from "../../shared/api.js";
import { getPrisma } from "../db.js";
import { sendError } from "../http.js";

export const healthRouter = express.Router();

// Uptime check (TECH_SPEC section 6). Reads the Household table, so it fails if
// the database is unreachable or migrations haven't run.
healthRouter.get("/health", async (_req, res) => {
  try {
    await getPrisma().household.findFirst({ select: { id: true } });
  } catch (err) {
    console.error("Health check failed", err);
    sendError(res, 503, "DATABASE_UNAVAILABLE", "Database check failed");
    return;
  }
  const body: HealthResponse = { status: "ok", database: "ok" };
  res.json(body);
});
```

- [ ] **Step 9: Mount the router in `server/app.ts`**

Add the import below the existing `./http.js` import:

```ts
import { healthRouter } from "./routes/health.js";
```

and add the route right after `app.use(express.json());`:

```ts
  app.use("/api", healthRouter);
```

- [ ] **Step 10: Run the tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: 7 tests pass (3 from Task 1, 4 new) and `tsc -b` exits 0.

- [ ] **Step 11: Create and apply the first migration on the Neon `dev` branch**

Run: `npx prisma migrate dev --name init_household`
Expected: it creates `prisma/migrations/<timestamp>_init_household/migration.sql` and `prisma/migrations/migration_lock.toml`, and reports `Your database is now in sync with your schema.` Prisma 7 doesn't regenerate the client after `migrate dev`, so run `npx prisma generate` next.

If it fails with a permission error about the shadow database, generate the SQL without one and apply it:

```bash
TS=$(date -u +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_init_household"
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script --output "prisma/migrations/${TS}_init_household/migration.sql"
printf '# Please do not edit this file manually\nprovider = "postgresql"\n' > prisma/migrations/migration_lock.toml
npx prisma migrate deploy
```

Expected from `migrate deploy`: `All migrations have been successfully applied.`

- [ ] **Step 12: Write `server/dev.ts`**

```ts
// Local development only: Vercel imports the app from api/index.ts instead.
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);

createApp().listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
```

- [ ] **Step 13: Smoke-test against the Neon `dev` branch**

```bash
npx tsx --env-file=.env server/dev.ts &
sleep 3
curl -s localhost:3000/api/health; echo
curl -s localhost:3000/api/nope; echo
kill %1
```

Expected:

```
{"status":"ok","database":"ok"}
{"error":{"code":"NOT_FOUND","message":"No route for GET /api/nope"}}
```

A `pg` "SECURITY WARNING" about SSL modes may appear in the server output. It's expected: Neon's URLs use `sslmode=require`, which `pg` currently treats as the stricter `verify-full`.

- [ ] **Step 14: Commit**

```bash
git add package.json package-lock.json .gitignore prisma.config.ts prisma/ server/db.ts server/db.test.ts server/routes/ server/app.ts server/dev.ts
git commit -m "Add Prisma with Household model and database-backed /api/health"
```

---

### Task 3: React page, Vite proxy and `npm run dev`

**Files:**
- Create: `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`
- Modify: `tsconfig.json`, `package.json` (scripts)

**Interfaces:**
- Consumes: `GET /api/health`; `ApiError` and `HealthResponse` from `shared/api.ts`.
- Produces: `npm run dev` (Vite on 5173 plus Express on 3000) and `npm run build` (`tsc -b && vite build` → `dist/`).

- [ ] **Step 1: Install the frontend packages**

```bash
npm install react react-dom
npm install -D vite @vitejs/plugin-react @types/react @types/react-dom concurrently
```

- [ ] **Step 2: Write `tsconfig.app.json` and `tsconfig.node.json`, and reference them from `tsconfig.json`**

`tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "types": ["vite/client"],
    "skipLibCheck": true,
    "strict": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "shared"]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "nodenext",
    "types": ["node"],
    "skipLibCheck": true,
    "strict": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts", "prisma.config.ts"]
}
```

`tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.server.json" }
  ]
}
```

- [ ] **Step 3: Write `vite.config.ts`**

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In development, Express runs separately on port 3000 (server/dev.ts).
    proxy: { "/api": "http://localhost:3000" },
  },
});
```

- [ ] **Step 4: Write `index.html`, `src/main.tsx` and `src/App.tsx`**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>JAALS Chore Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { ApiError, HealthResponse } from "../shared/api.ts";

type Check =
  | { state: "checking" }
  | { state: "ok"; body: HealthResponse }
  | { state: "failed"; reason: string };

async function checkHealth(): Promise<Check> {
  try {
    const res = await fetch("/api/health");
    if (res.ok) return { state: "ok", body: (await res.json()) as HealthResponse };
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return { state: "failed", reason: body?.error.message ?? `HTTP ${res.status}` };
  } catch (err) {
    return { state: "failed", reason: err instanceof Error ? err.message : String(err) };
  }
}

export default function App() {
  const [check, setCheck] = useState<Check>({ state: "checking" });

  useEffect(() => {
    checkHealth().then(setCheck);
  }, []);

  return (
    <main>
      <h1>JAALS Chore Tracker</h1>
      <p>
        {check.state === "checking" && "Checking the API…"}
        {check.state === "ok" && `API: ok · Database: ${check.body.database}`}
        {check.state === "failed" && `API check failed: ${check.reason}`}
      </p>
    </main>
  );
}
```

- [ ] **Step 5: Add the `dev`, `build` and `preview` scripts**

Set the `scripts` block in `package.json` to:

```json
  "scripts": {
    "dev": "concurrently -k -n web,api -c cyan,magenta \"vite\" \"tsx watch --env-file=.env server/dev.ts\"",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "postinstall": "prisma generate",
    "test": "vitest run",
    "typecheck": "tsc -b"
  }
```

- [ ] **Step 6: Typecheck, test and build**

Run: `npm run typecheck && npm test && npm run build`
Expected: `tsc -b` exits 0, 7 tests pass, and Vite writes `dist/index.html` plus `dist/assets/index-*.js`.

- [ ] **Step 7: Run the full dev setup and check it through the Vite proxy**

```bash
npm run dev &
sleep 5
curl -s localhost:5173/api/health; echo
curl -s localhost:5173/ | grep -o '<div id="root"></div>'
```

Expected:

```
{"status":"ok","database":"ok"}
<div id="root"></div>
```

Then open http://localhost:5173 in a browser and confirm the page reads **"API: ok · Database: ok"**. Stop the servers with `kill %1`. If any process is still holding port 5173 or 3000 afterwards, check with `lsof -ti :5173 :3000` and stop it.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html src/
git commit -m "Add React page that checks /api/health, with Vite proxy and dev script"
```

---

### Task 4: Vercel Function entry, `vercel.json`, and the preview deploy

**Files:**
- Create: `api/index.ts`, `vercel.json`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `createApp()` from `server/app.ts`.
- Produces: a Vercel preview deployment where `/api/*` reaches Express, other paths serve the React app, and migrations run during the build.

- [ ] **Step 1: Write `api/index.ts`**

```ts
// Vercel Function entry. vercel.json rewrites every /api/* request here; Express routes it.
import { createApp } from "../server/app.js";

export default createApp();
```

- [ ] **Step 2: Write `vercel.json`**

The Vercel project's dashboard preset is "Other", which would serve `public/` or the repo root instead of Vite's `dist/`, so the framework and output directory are set here explicitly.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run vercel-build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 3: Add the `vercel-build` script**

Add this line to the `scripts` block in `package.json`, directly after `"build"`:

```json
    "vercel-build": "prisma generate && prisma migrate deploy && npm run build",
```

`prisma generate` runs again here so the client exists even if Vercel restores a cached `node_modules` without running `postinstall`. `prisma migrate deploy` uses `DATABASE_URL_UNPOOLED`, which the Neon integration sets to the preview branch on previews and to `main` in production.

**Never run `npm run vercel-build` or `vercel build` locally with Vercel's pulled environment variables.** That would run migrations against whatever database those variables point to.

- [ ] **Step 4: Check the entry point locally**

```bash
npm run typecheck && npm test
npx tsx -e 'const m = await import("./api/index.ts"); console.log(typeof m.default, typeof m.default.listen)'
```

Expected: typecheck passes, 7 tests pass, and the last command prints `function function`. That means the default export is an Express app, which is what Vercel's Node runtime expects.

- [ ] **Step 5: Commit, push and open a draft pull request**

```bash
git add api/index.ts vercel.json package.json
git commit -m "Add Vercel Function entry and vercel.json for the deploy skeleton"
git push -u origin feat/spike-1-skeleton
gh pr create --draft --title "Spike 1: deploy skeleton" --body "Implements Spike 1 from TECH_SPEC section 10: Vite + React + TypeScript page, Express /api/health reading Neon through Prisma, deployed as one Vercel project. Plan: docs/superpowers/plans/2026-10-01-spike-1-deploy-skeleton.md"
```

- [ ] **Step 6: Wait for the preview and get its URL**

```bash
gh pr checks --watch
vercel ls si526-team --scope si-526 2>&1 | head -8
```

Expected: the Vercel check passes, and the newest deployment in the list is a `Preview` URL ending in `.vercel.app`. Use that URL as `$URL` below.

- [ ] **Step 7: Confirm migrations ran in the build**

Run: `vercel inspect "$URL" --logs --scope si-526 2>&1 | grep -iE "migration|prisma|error"`
Expected: Prisma generated the client, found 1 migration (`<timestamp>_init_household`) and applied it, then printed `All migrations have been successfully applied.` This ran against the new `preview/feat/spike-1-skeleton` Neon branch.

- [ ] **Step 8: Check routing and the database on the preview**

`vercel curl` gets past preview protection automatically.

```bash
vercel curl /api/health --deployment "$URL" --scope si-526; echo
vercel curl /api/nope --deployment "$URL" --scope si-526; echo
vercel curl /chores --deployment "$URL" --scope si-526 | grep -o '<div id="root"></div>'
```

Expected:

```
{"status":"ok","database":"ok"}
{"error":{"code":"NOT_FOUND","message":"No route for GET /api/nope"}}
<div id="root"></div>
```

Line 1 proves that the function bundling worked (including the runtime `apiError` import from `shared/` and the generated Prisma client), and that the pooled connection works. Line 2 proves the `/api` rewrite reaches Express. Line 3 proves a client-side path serves the React app (Review Focus 5).

Then ask Anthony to open `$URL` in a browser where they're signed in to Vercel and confirm the page reads **"API: ok · Database: ok"**.

- [ ] **Step 9: If the preview fails, debug it before changing anything**

Use superpowers:systematic-debugging. Start with `vercel inspect "$URL" --logs` for build errors and `vercel logs "$URL"` for runtime errors. Known failure modes and their fixes:
- `prisma: command not found` in the build → move `prisma` from `devDependencies` to `dependencies` (Prisma's Vercel guide).
- `ERR_MODULE_NOT_FOUND` at runtime → a relative import in `api/`, `server/` or `shared/` doesn't end in `.js`.
- Runtime error about a missing `.wasm` file under `@prisma/client` → file tracing missed Prisma's query compiler. Add `"functions": { "api/index.ts": { "includeFiles": "node_modules/@prisma/client/runtime/*.wasm" } }` to `vercel.json`, after confirming the exact filename in `node_modules/@prisma/client/runtime/`.

Record any fix and its cause. Task 5 writes it into the spec.

---

### Task 5: Record the result in the spec and README

**Files:**
- Modify: `TECH_SPEC.md`, `README.md`

**Interfaces:**
- Consumes: the verified preview from Task 4 (the PR number from `gh pr view --json number -q .number`, and any fixes recorded in Task 4 Step 9).
- Produces: an up-to-date spec and a README quickstart.

- [ ] **Step 1: Update `TECH_SPEC.md`**

Make these edits, using the real PR number for `#N`:

1. Section 3, the `vercel.json` code block: replace it with the `vercel.json` from Task 4 Step 2. Replace the sentence after it with: "The first rewrite sends all API paths to the Express function. The second lets React Router handle all other paths. `framework` and `outputDirectory` are set here because the Vercel project's dashboard preset is \"Other\". Spike 1 confirmed this setup (PR #N)."
2. Section 3, after the repo layout block, add:
   ```
   **Conventions confirmed in Spike 1:**

   - Relative imports in `api/`, `server/` and `shared/` end in `.js` (for example `../server/app.js`). TypeScript maps them to the `.ts` files, and Vercel compiles each `.ts` file to `.js`. React code in `src/` uses Vite's style (`./App.tsx`).
   - The Prisma client is generated into `server/generated/prisma/` (git-ignored) by `postinstall` and again by `vercel-build`.
   - Prisma packages are pinned to exactly `7.10.0`. npm's `latest` tag for `prisma` points to an 8.0 release candidate, so don't upgrade without pinning.
   ```
3. Section 10: change `- [ ] **Spike 1: deploy skeleton.**` to `- [x] **Spike 1: deploy skeleton.**` and append to the end of that bullet: " Done 2026-10-01 in PR #N." Add any Task 4 Step 9 fix as a sentence there.
4. Section 12: change the Spike 1 row to `| Spike 1: deploy skeleton | Done, verified | PR #N: preview served the page, \`/api/health\` read Neon through Prisma, and the build applied the first migration |`. Change the "Local `.env`" row's note to `On both of Anthony's machines`. In "Next steps", delete item 2 ("Run Spike 1…") and renumber.
5. Section 14, step 6: replace it with:
   ```
   6. **Install and run:** `npm install` (this also generates the Prisma client), then `npm run dev`. Open http://localhost:5173; the page should read "API: ok · Database: ok". Run `npm test` for the unit tests.
   ```

- [ ] **Step 2: Replace `README.md`**

```markdown
# si526-team

Shared chore tracker for Team JAALS (SI 526). See [TECH_SPEC.md](TECH_SPEC.md) for the design, decisions and setup status.

## Quick start

Needs Node.js 24 and a `.env` file (copy `.env.example` and fill in the Neon `dev` branch connection strings; see TECH_SPEC section 14).

    npm install      # also generates the Prisma client
    npm run dev      # React on http://localhost:5173, API on http://localhost:3000
    npm test         # unit tests

## Database changes

Edit `prisma/schema.prisma`, then run `npx prisma migrate dev --name <what-changed>` and commit the new folder in `prisma/migrations/`. Vercel applies migrations automatically when it builds.
```

- [ ] **Step 3: Commit, push and mark the pull request ready**

```bash
git add TECH_SPEC.md README.md
git commit -m "Record Spike 1 result in spec and add README quick start"
git push
gh pr ready
```

Expected: the PR leaves draft status and the new push builds a fresh preview. The PR needs 1 approval to merge (spec section 13). After merge, the production build runs `prisma migrate deploy` against the Neon `main` branch. Confirm with `vercel curl /api/health --deployment <production URL> --scope si-526`.
