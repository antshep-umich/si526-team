# Tech debt

Known small problems we've chosen to fix later. None of them affects anyone using the app today. When you fix one, delete its entry in the same pull request.

Each entry says where the problem is, what goes wrong, and when it needs fixing.

| # | Item | Fix by |
|---|---|---|
| 2 | `npm run dev` without `.env` stops at startup | Any time |
| 3 | Health check page breaks on unexpected error bodies | Any time |
| 4 | Health route tests don't reset the fake database | Before adding more tests to that file |
| 5 | 404 message repeats the full URL | Before 404s are logged or shown as HTML |
| 6 | Sign-in rate limiting is per Function instance | Before the app is shared outside the team |
| 7 | "Forgot your password?" lets anyone reset any account | Before anyone outside the team and research participants uses the app |

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

## 6. Sign-in rate limiting is per Function instance

**Where:** `server/auth.ts`, `createAuth` (Better Auth's `rateLimit` option, currently left at its defaults)

**What goes wrong:** on Vercel, Better Auth limits requests to 100 per 10 seconds per client, but it keeps the counts in memory. Each Function instance has its own memory, so the limit is per instance and resets whenever an instance starts. Someone guessing passwords would be slowed down less than the numbers suggest. Locally, rate limiting is off.

**Why it waits:** the only users are the team and about 10 research participants, and passwords are hashed.

**Fix:** set `rateLimit: { storage: "database" }`, plus stricter `customRules` for `/sign-in/email` (for example 5 per minute). Run `npx auth@latest generate` again to add the `rateLimit` table, then create a migration.

## 7. "Forgot your password?" lets anyone reset any account

**Where:** `server/routes/passwordReset.ts` (`POST /api/password-reset`) and `src/screens/ForgotPassword.tsx`

**What goes wrong:** the stand-in reset asks only for an email address, then sets a new password for that account. Anyone who knows (or guesses) a housemate's email can take over their account. It also tells a visitor whether an email has an account. The route isn't covered by Better Auth's rate limiting.

**Why it waits:** there's no email in the MVP (TECH_SPEC section 8), the frame isn't designed yet, and the only users are the team and research participants, who know each other.

**Fix:** when email is added, switch to Better Auth's own reset (`requestPasswordReset` sends a link; `resetPassword` takes the token from it), delete this route and its tests, and give the screen the designed frames.

