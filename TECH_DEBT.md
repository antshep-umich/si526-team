# Tech debt

Known small problems we've chosen to fix later. None of them affects anyone using the app today. When you fix one, delete its entry in the same pull request.

Each entry says where the problem is, what goes wrong, and when it needs fixing.

| # | Item | Fix by |
|---|---|---|
| 1 | Some 4xx request errors come back as 500 | Before the first API route that accepts data |
| 2 | `npm run dev` without `.env` stops at startup | Any time |
| 3 | Health check page breaks on unexpected error bodies | Any time |
| 4 | Health route tests don't reset the fake database | Before adding more tests to that file |
| 5 | 404 message repeats the full URL | Before 404s are logged or shown as HTML |

## 1. Some 4xx request errors come back as 500

**Where:** `server/http.ts`, `handleError` (lines 14–25)

**What goes wrong:** Express's JSON body parser already marks some bad requests with the right status code:

- 413: the body is over the 100 KB limit
- 415: unsupported character set or encoding
- 400: the request was aborted mid-upload

`handleError` only recognises invalid JSON (400). Everything else becomes a 500 "Something went wrong", which wrongly suggests the server is broken, and the error is logged as a server error.

**Why it waits:** no route accepts a request body yet.

**Fix:** if the error has a 4xx `status` and `expose` is true, send that status with a generic code (for example `PAYLOAD_TOO_LARGE` or `BAD_REQUEST`). Never send the error's own message for a 5xx. Add a test that posts an oversized body and expects 413, next to the invalid JSON test in `server/app.test.ts`.

## 2. `npm run dev` without `.env` stops at startup

**Where:** `package.json`, `dev` script (line 10)

**What goes wrong:** `tsx watch --env-file=.env` stops with ".env: not found" when there is no `.env` file, and `concurrently -k` then stops Vite too. The API code itself handles a missing `DATABASE_URL` cleanly: `/api/health` returns 503 with "DATABASE_URL is not set". A teammate who hasn't created `.env` never gets that far.

**Why it waits:** the startup message still names the missing file, and TECH_SPEC section 14 tells people to create `.env` first.

**Fix:** switch to `--env-file-if-exists=.env` (Node 22.9 and later). The app then starts and the page reports the missing database setting. Check that the flag works through `tsx` before relying on it.

## 3. Health check page breaks on unexpected error bodies

**Where:** `src/App.tsx`, `checkHealth` (line 14)

**What goes wrong:** when the API returns an error that is JSON but not in our `{ error: { code, message } }` format (for example a Vercel platform error), `body?.error.message` throws. The page then shows "Cannot read properties of undefined" instead of the HTTP status.

**Fix:** ``body?.error?.message ?? `HTTP ${res.status}` ``.

## 4. Health route tests don't reset the fake database

**Where:** `server/routes/health.test.ts`, `afterEach` (lines 11–13)

**What goes wrong:** `vi.restoreAllMocks()` only undoes `vi.spyOn` spies. The fake `findFirst` and `getPrisma` keep their call history between tests. Today only the first test checks calls, so nothing is affected. A later test that asserts "was called with…" could pass because of an earlier test's call.

**Fix:** add `vi.clearAllMocks()` to the `afterEach`.

## 5. 404 message repeats the full URL

**Where:** `server/app.ts`, the 404 handler (line 16)

**What goes wrong:** the message "No route for GET …" includes `req.originalUrl`, query string and all. That's harmless in a JSON response. If these messages are ever logged, or shown in HTML, a token in a query string would end up there too.

**Fix:** use `req.path` instead of `req.originalUrl`, and update the expected message in `server/app.test.ts` if it changes.
