# AGENTS.md

Briefing for AI coding agents (and people) working in this repo. Read this first; it should
save you from exploring the codebase. Deeper detail lives in `TECH_SPEC.md` (§ numbers below),
`TECH_DEBT.md` and `README.md`. **If you change anything this file describes, update it in the
same commit.**

_Last updated: 2026-10-20, on `Sprint2_Dev` (commit `9b2abde` and later)._

## The project

A shared chore tracker for people who live together (SI 526, Team JAALS: Jennifer, Shivani,
Ankun, Anthony, Louise). People sign up, create or join a **household** with an invite code,
and (next) add chores, see the household's chore list and mark chores done.

- **Mobile web only** for now (designed at 402×874, the iPhone 17 frame). iOS/Android may come later, which is why the API is a plain JSON API.
- **Light and dark mode follow the device setting.** There is no in-app switch (the `/components` dev page has one).
- About 10 research participants; no sensitive data. Email isn't built yet (TECH_SPEC §8).

## Stack

| Part | What | Notes |
|---|---|---|
| Frontend | React 19 + Vite 8, TypeScript, CSS Modules | No router, no Tailwind, no UI library |
| Backend | Express 5 on Vercel Functions | One function: `api/index.ts` → `server/app.ts` |
| Database | Postgres 18 on Neon, Prisma **7.10.0 (pinned exactly; don't upgrade)** | Client generated into `server/generated/prisma/` (git-ignored) |
| Auth | Better Auth 1.7.10, email + password, cookie sessions | Runs inside our Express app, data in our Postgres |
| Tests | Vitest 5 everywhere: Supertest, Testing Library + jsdom, Playwright | See Testing |
| Hosting | Vercel Hobby, GitHub `antshep-umich/si526-team` | Node 24 |

## Commands

```
npm install            # also runs prisma generate
npm run dev            # Vite on :5173 + API on :3000 (Vite proxies /api). Needs .env
npm run typecheck      # tsc -b across app, server, node and e2e configs
npm test               # server + web unit tests (~10 s, no database)
npm run test:e2e       # real browser vs local app + dev DB (run `npx playwright install chromium` once)
npm run build          # what Vercel builds (plus `prisma migrate deploy` in build:vercel)
npx prisma migrate deploy               # apply teammates' migrations to the dev DB (never resets)
npx prisma migrate dev --name <change>   # after editing prisma/schema.prisma; commit the migration folder
```

Before you call work done: `npm run typecheck && npm test`, and `npm run test:e2e` if you touched
screens, auth, routes or the database.

## Repo map

```
api/index.ts            Vercel entry; exports createApp()
server/                 Express API (layers below)
  app.ts                wires middleware and routers; read this first on the server
  auth.ts               Better Auth config, allowed hosts, session resolver
  db.ts                 the one Prisma client
  middleware/ routes/ controllers/ services/ models/   the layers
  test/fakeModels.ts    in-memory models for server tests
  architecture.test.ts  enforces the layer rules
shared/                 imported by both server and frontend
  api.ts                API response types, apiError(), validation (parseHouseholdName, normalizeInviteCode)
  httpStatus.ts         HttpStatus.CREATED etc. Use these, never bare numbers
src/                    React app
  App.tsx               which screen to show (session + household state machine)
  screens/              one file per Figma screen, plus Screen.tsx (shared layout)
  components/           design-system components (from Figma), each with a .module.css
  styles/               tokens.css (colors, type), fonts.css, base.css
  api/                  fetch helpers that never throw: return { ok: true, … } | { ok: false, code }
  auth.ts               Better Auth React client (authClient)
  demo/                 /components.html dev page (every component, theme switch, sizes)
e2e/                    Playwright tests driven by Vitest
prisma/                 schema.prisma + migrations
TECH_SPEC.md            design, decisions, data model, API, status codes, setup
TECH_DEBT.md            known small problems and when to fix them
```

## Server architecture (TECH_SPEC §3)

A request goes through six layers in order. **Each layer may only use the layers below it.**
`server/architecture.test.ts` checks the imports and fails `npm test` if a layer reaches too far.

| # | Layer | Does | Must not |
|---|---|---|---|
| 1 | `middleware/` | `requireUser` (401), `requireHousehold` (404 `NO_HOUSEHOLD`, sets the membership), `requireJsonBody` (415), `handleError`, `notFound`, `methodNotAllowed` (405 + `Allow`) | import models, db or Prisma |
| 2 | `routes/` | map URL + middleware → controller: `router.route("/join").post(households.join).all(methodNotAllowed)` | contain logic; import services/models |
| 3 | `controllers/` | read the request (`bodyText(req, "name")`), call a service, pick the status, shape the response (`toHouseholdResponse`) | import models, db or Prisma |
| 4 | `services/` | the rules. Throw `ServiceError(code, userMessage)` when a rule is broken | import Express, Prisma or `db.ts` |
| 5 | `models/` | the only code that queries the database; functions, not classes (`findHouseholdByInviteCode`). Unique violations become `UniqueConflictError` | import services, controllers or Express |
| 6 | `db.ts` | creates the Prisma client lazily (missing `DATABASE_URL` → request error, not a crash) | — |

`models/accounts.ts` reaches Better Auth's tables (user, account, session) **through Better Auth**
(`getAuth().$context`), so passwords are hashed exactly as sign-up does. Don't query those tables with Prisma directly.

### Adding an endpoint

1. **Model**: add query functions in `models/<table>.ts` (wrap writes in `translateUniqueConflict`).
2. **Service**: add the rule function in `services/<area>.ts`. New error code? Add it to `ServiceErrorCode` in `services/errors.ts` **and** to `STATUS_BY_CODE` in `middleware/errors.ts` (it won't compile otherwise).
3. **Controller**: in `controllers/<area>.ts`, read input with `bodyText`, call the service, respond with an `HttpStatus` constant.
4. **Route**: `router.route(path).<method>(…).all(methodNotAllowed)`; mount new routers in `app.ts` (behind `requireUser`, and `requireJsonBody` if it reads a body).
5. **Shared types**: response shapes go in `shared/api.ts`.
6. **Tests**: route test (Supertest through `createApp`, models faked with `fakeModels.ts`), service test, model test (stub Prisma client). Update TECH_SPEC §6.

### API contract (TECH_SPEC §6)

- JSON only. Errors are always `{ "error": { "code": "SOME_CODE", "message": "for people" } }`.
- Status codes: 201 + `Location` on create/join (join is 200 if already a member), 204 for no body, 401 not signed in (checked first), 403 not allowed, 404 unknown route or no household, 405 + `Allow` for a wrong method, 409 conflict, 415 non-JSON body, **422 for well-formed input that breaks a rule** (including an unknown invite code or email), 429 rate limit, 500 bug (details only in the server log), 503 health check failed.
- The frontend reacts to the error **`code`**, not the status. Don't rename codes casually.

### Auth and authorization

- Better Auth is mounted at `/api/auth/*` **before** `express.json()` (it reads its own body). Frontend uses `authClient` from `src/auth.ts` (`signIn.email`, `signUp.email`, `signOut`, `useSession`).
- Better Auth only accepts our hosts (`server/auth.ts`): `si526-team.vercel.app`, `si526-team-si-526.vercel.app`, `si526-team-*-si-526.vercel.app` (previews), and `localhost` locally. No `BETTER_AUTH_URL` is needed.
- **Authorization rule:** routes never take a household id. "Current household" always comes from `requireHousehold` → `currentMembership(res).householdId`. Every chore query must be scoped the same way.
- Deployed sites rate-limit sign-in and sign-up (3 requests, then 10 quiet seconds). Off locally.
- `POST /api/password-reset` is a **stand-in** that resets with only an email (TECH_DEBT #7). Don't build on it; it gets replaced by Better Auth's emailed reset once email exists.

### Data (TECH_SPEC §5, §7)

- Tables: `Household` (uuid id, name, unique `inviteCode`), `Membership` (unique `userId` = one household per user for now; role `owner` | `member`), plus Better Auth's `user`, `session`, `account`, `verification`. Planned next: `Chore`, `ChoreCompletion`.
- Invite codes: 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (`services/inviteCode.ts`). Users can type them in any case with spaces or hyphens.
- Neon branches: `main` = production, `dev` = local development (`.env`), and one throwaway `preview/<git-branch>` per Vercel preview. Vercel builds run `prisma migrate deploy`, so a migration in a pull request runs on that pull request's preview database only.

## Frontend (TECH_SPEC §3, README "Design system")

- **No router.** `src/App.tsx` picks the screen: signed out → Log in / Sign up / Forgot password; signed in without a household → Your household / Create / Join; just created → Household Created!; otherwise → Home.
- **Screens** use `Screen` (`src/screens/Screen.tsx`): 402px max width, 24px sides, 60px top, 40px between items (`tight` = 24px). `Actions` groups a full-width button with the link under it. Errors go on the field they belong to (`TextField error=…`); others go in `FormError`.
- **API helpers** (`src/api/`) never throw: `{ ok: true, household } | { ok: false, code }`. `NETWORK_ERROR` when the server can't be reached. Screens map codes to their own wording.
- **Design system** comes from the Figma file `rTlKUmhGVqZ9wXJUehed8i` ("App Design": pages Colors & Fonts `15:3`, Components `15:2`, Mock up (Sprint 2) `287:49`).
  - Colors and type **only** via tokens in `src/styles/tokens.css` (`var(--color-action-primary)`, `font: var(--type-body)`). Never hard-code a color or font. Token names mirror the Figma variables.
  - Fonts: Libron (serif, committed in `src/assets/fonts/libron`) and Atkinson Hyperlegible Next (sans, npm `@fontsource`).
  - Reuse `src/components/` (Button, TextField, Chip, ChoreCard, TabBar, …) before writing new markup. Each component has a `.module.css`; keep sizes exactly as in Figma.
  - Icons have their colors baked in, so each has a light and a dark SVG (`src/assets/icons/{light,dark}`), shown by `ThemedIcon`. A new icon needs both files.
  - Check visual work on `/components.html` (theme switch + "Show sizes").
- Accessibility is tested: label every input, give icon buttons an `aria-label`, use real buttons.

## Testing (README "Tests")

| Project | Files | Notes |
|---|---|---|
| `server` | `server/**/*.test.ts`, `shared/**/*.test.ts` | Route tests use `createApp({ getSessionUser })` with an `x-test-user` header, and fake models via `vi.mock("../models/households.js", () => import("../test/fakeModels.js"))` (same for memberships). `fakeModels.ts` is typed against the real models. |
| `web` | `src/**/*.test.{ts,tsx}` | jsdom + Testing Library. Mock `../auth.ts` and `../api/*.ts` with `vi.hoisted` + `vi.mock`. CSS Module class names are unhashed in tests (`toHaveClass("primary")`). |
| `e2e` | `e2e/*.e2e.test.ts` | Real Chromium at 402×874. Locally it reuses or starts `npm run dev` and deletes its `@e2e.test` accounts afterwards. `E2E_BASE_URL=<url>` targets a deployment, with sign-ins paced for the rate limit. |

- Find elements by role and visible label (`getByRole("button", { name: "Log in" })`), not class names or test ids. Test files sit next to the code they test.
- CI (`.github/workflows/`): `tests.yml` runs typecheck + `npm test` on every push and pull request. `e2e-preview.yml` runs the e2e suite against each **preview** deployment (never production).

## Conventions

- TypeScript strict, with `verbatimModuleSyntax` and **`erasableSyntaxOnly`**: no `enum`s, no constructor parameter properties, no namespaces. Use `as const` objects.
- Relative imports in `server/`, `shared/`, `api/`, `e2e/` end in **`.js`** (`../services/households.js`); in `src/` they end in **`.ts`/`.tsx`** (Vite style).
- Comments explain *why* or point to the spec; keep them short. Match the surrounding code's style.
- User-facing copy is plain and friendly ("Couldn't reach the server. Check your connection and try again.").
- **Git:** work on a branch, merge to `main` by pull request (1 approval; the owner can bypass). Merged branches are deleted automatically. Commit with the email of the GitHub account that has repo access (`git config user.email`). Current work happens on `Sprint2_Dev`, which is ahead of `main` and not merged yet.

## Gotchas

- `.env` is not in git. Copy `.env.example` and fill in the Neon **dev** branch strings and a `BETTER_AUTH_SECRET`. Never commit `.env*` (only `.env.example`).
- **The dev database is shared by the whole team.** Run `npx prisma migrate deploy` before `migrate dev`. Never run `prisma migrate reset`, and never accept a reset prompt; it deletes everyone's data. If drift is reported, stop and ask.
- `npm run dev` stops at once without `.env` (TECH_DEBT #2).
- Don't edit `server/generated/` (regenerated by `prisma generate`).
- The Vercel build script is `build:vercel`, **not** `vercel-build`. Vercel runs a script called `vercel-build` by itself, which made builds run twice.
- Preview URLs are public (no Vercel login). Don't share them outside the team.
- The team develops on Windows: PowerShell and Git Bash. CRLF warnings from git are harmless.
- Some contributors have two GitHub accounts. A 403 on push usually means the wrong one is active (`gh auth switch`, then `gh auth setup-git`).

## Current state (2026-10-20)

**Done:** Feasibility spikes 1–3 (Vercel + Express + Prisma deploy, Better Auth, teammate deploys) · design tokens and all Figma components · Sprint 2 screens (SCRUM-2 Sign Up, SCRUM-3 Log in/Log out, SCRUM-4 Create a Household, SCRUM-5 Join a Household) + stand-in Forgot password · household API with member names · six-layer server · status codes · unit, component and e2e tests in CI.

**Next (MVP, TECH_SPEC §4):**
1. Chores: add, list, mark done/undo, edit/delete. Data model in §5 (`Chore`, `ChoreCompletion`), endpoints in §6. Build it with the six layers; scope every query with `requireHousehold`. `ChoreCard`, `ProgressCard`, `OverdueBanner` and `TabBar` already exist.
2. Gaps found while building Sprint 2:
   - The invite code is only shown on Household Created!. There is no way to see it again (suggest an item in the Home menu).
   - "Your household" has no Log out.
   - Invite codes are 8 characters, but Figma shows 6.
3. Undesigned states (pressed, loading, disabled, empty states, toasts) are listed for UX in the Figma frame "UX Please Read". Code standing in for them has a `Not in Figma yet` or `Not designed yet` comment; search for those before redesigning.

**Known problems:** TECH_DEBT.md (#2 dev without .env, #4 health route tests don't reset their mocks, #5 404 message echoes the URL, #6 rate limit per instance, #7 stand-in password reset).

**Open team questions:** TECH_SPEC §11 (one household per user? who can edit/delete chores? recurring chores in cycle 1?).

## Don'ts

- Don't bypass the layers (the architecture test will fail anyway), and don't take household ids from requests.
- Don't add Tailwind, a UI kit, a router or a state library without a team decision (TECH_SPEC §2).
- Don't hard-code colors, fonts or status numbers.
- Don't change Better Auth's tables by hand or query them with Prisma. Use `models/accounts.ts`.
- Don't put secrets in code, tests, docs or commit messages.
- Don't run e2e tests against production. CI only targets previews.
