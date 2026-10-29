# Technical Spec: Shared Chore Tracker

**Team JAALS** (SI 526): Jennifer, Shivani, Ankun, Anthony, Louise
**Owner:** Anthony (Dev), as part of the feasibility review
**Last updated:** 2026-10-01
**Status:** Draft. Stack decisions are made; items marked *Proposed* are open for team input. For setup progress and next steps, see [section 12](#12-setup-status-feasibility-review-tracker).

---

## 1. Summary

A web app where people who share a home add chores, see one shared chore list, and mark chores complete. The MVP covers only that loop. Automatic assignment, availability and email reminders come in later cycles, depending on what research shows.

**Feasibility verdict:** feasible on free tiers with standard JavaScript tooling. No paid services, institutional data or sensitive information are needed. The open risks are operational (free-tier limits, shared account access) and are listed in [section 9](#9-risks).

---

## 2. Decisions

| Area | Decision | Status |
|---|---|---|
| Version control | GitHub, public repo (`antshep-umich/si526-team`) | Decided |
| Hosting | Vercel Hobby (free), default `*.vercel.app` domain. Project `si526-team` in the `si-526` team, owned by `antshep-umich` | Decided, provisioned |
| Language | TypeScript everywhere (frontend, API, scripts) | Decided |
| Frontend | React, built with Vite | Decided |
| Backend | Express, deployed as a Vercel Function under `/api` | Decided |
| Database | Postgres on Neon (free tier), added through the Vercel Marketplace as `jaals-db` | Decided, provisioned |
| ORM | Prisma | Proposed |
| Authentication | Better Auth, run inside our Express app (not Neon's managed auth), email and password, sessions stored in our Neon Postgres | Proposed |
| Email | Deferred to a later cycle. Planned provider: Brevo (see [section 8](#8-deferred-email-and-reminders)) | Decided (deferred) |
| Runtime | Node.js 24 LTS (matches Vercel's default and the team's local install) | Decided |
| Request validation | Zod schemas, shared by the frontend and the API | Proposed |
| Testing | Vitest for everything: Supertest for the API, Testing Library + jsdom for React, Playwright (driven from Vitest) for end-to-end. See the README's Tests section. CI runs them on every push and publishes a test dashboard (see [section 15](#15-testing-ci-and-the-test-dashboard)) | Decided |
| Code style | ESLint and Prettier | Proposed |

### Why these choices

- **Express instead of a full-stack framework such as Next.js.** It gives us a plain REST API that a future mobile client can use without changes. It is also simple to learn and easy to test on its own.
- **Neon instead of Supabase.** Supabase's free tier pauses inactive projects after about a week, which could take the app down between research sessions. Neon only sleeps while idle and wakes in about a second. It also connects to Vercel in a few clicks and sets the environment variables for us.
- **Postgres instead of MySQL.** Free hosting for Postgres is better, and Vercel's integrations are built around it.
- **Prisma.** Its schema file is readable by people who don't write code, so PM and UX can use it as a reference for the data model.
- **TypeScript.** The frontend, the API and the database all share types. Prisma generates types from the schema and Zod generates them from request schemas, so a renamed field shows up as a compile error instead of a runtime bug. Vercel and Vite compile TypeScript without extra setup.
- **Better Auth.** Free, open source and stores data in our own database. It handles password hashing and sessions so we don't write security code ourselves. It works with Express and with Prisma, and it is written in TypeScript.
- **Why not Neon's built-in auth ("Managed Better Auth").** Neon's free plan includes a hosted version of the same Better Auth library. We are not using it because:
  - Neon's roadmap lists standalone Express or custom backend frameworks as **not yet supported**. Its supported setups are Next.js and frontend-only apps that talk to Neon directly.
  - Our API would have to verify Neon-issued tokens itself (15-minute tokens, with refresh logic in the client), and we couldn't add our own server-side auth logic or plugins.
  - Auth would run on a separate Neon URL instead of our own domain.

  Running Better Auth ourselves costs about one config file, keeps login on the same origin as our API, and still stores users in Neon. Because both options use the same library, switching to Neon's managed version later is a small change if it ever adds Express support.
- **No custom domain.** Without one we can't verify an email-sending domain. That only matters once email is added; see [section 8](#8-deferred-email-and-reminders).

---

## 3. Architecture

```
Browser (React SPA)
   │  same origin: no CORS needed; session sent as an httpOnly cookie
   ▼
Vercel project (one deployment)
   ├── static files: Vite build output (dist/)
   └── /api/*  → Vercel Function → Express app
                                      │  pooled connection
                                      ▼
                               Neon Postgres
```

- **One repo, one Vercel project, one deployment.** The frontend and API ship together, so they can't drift out of sync.
- **Express runs as a serverless function**, which means:
  - Nothing can be kept in server memory between requests. Sessions and caches live in Postgres.
  - No background timers (`setInterval` or node-cron). Scheduled work uses Vercel Cron or GitHub Actions (later cycles).
  - The app must use Neon's **pooled** connection string so that function cold starts don't use up all the database connections.
- **Mobile later:** a mobile client calls the same `/api` routes. Better Auth supports bearer-token sessions for clients that can't use cookies.

### Repo layout

```
/
├── .github/workflows/    # tests.yml (typecheck, tests, dashboard), e2e-preview.yml, neon-preview-cleanup.yml
├── acceptance/           # one JSON file of acceptance criteria per Jira story (section 15)
├── api/
│   └── index.ts          # Vercel entry point: imports and exports the Express app
├── server/
│   ├── app.ts            # builds the Express app and wires the layers below; no app.listen
│   ├── dev.ts            # local only: imports app and calls app.listen(3000); run with tsx
│   ├── auth.ts           # Better Auth config
│   ├── middleware/       # 1. session.ts (requireUser), household.ts (requireHousehold), errors.ts
│   ├── routes/           # 2. URL + middleware → controller: households.ts, chores.ts, ...
│   ├── controllers/      # 3. request in, response out: households.ts, chores.ts, ...
│   ├── services/         # 4. the app's rules: households.ts, chores.ts, ...
│   ├── models/           # 5. the only database code: households.ts, memberships.ts, accounts.ts, ...
│   ├── db.ts             # 6. Prisma client (single shared instance)
│   └── test/             # fakeModels.ts: in-memory models for tests
├── shared/
│   └── api.ts            # types and validation shared by the frontend and the API
├── prisma/
│   └── schema.prisma
├── scripts/test-report/  # test results, AC coverage and the dashboard site (section 15)
├── src/                  # React app, .tsx (Vite default location)
├── public/
├── index.html            # Vite entry point
├── vite.config.ts        # dev proxy: /api → http://localhost:3000
├── vitest.config.ts      # test projects (server, web, scripts, e2e), story tags and report mode
├── tsconfig.json         # strict mode on
├── vercel.json           # rewrites (see below)
└── package.json          # one package.json for client and server
```

**Server layers** (adopted 2026-10-17; controllers and models added 2026-10-20). A request passes through them in order, and each layer only uses the ones below it. `server/architecture.test.ts` checks the imports and fails `npm test` if a layer reaches past its neighbors.

1. **Middleware** handles what many routes share. `requireUser` rejects requests with no session. `requireHousehold` loads the user's membership, answers 404 `NO_HOUSEHOLD` if there isn't one, and is how routes enforce the household authorization rule (section 6). `handleError` turns each `ServiceError` code into its HTTP status and the JSON error format; the code-to-status table is in `middleware/errors.ts`.
2. **Routes** map a URL and its middleware to a controller, and nothing else: `router.post("/join", households.join)`.
3. **Controllers** read the request (`controllers/body.ts` for body fields), call a service, and shape and send the response (for example `toHouseholdResponse`). They never touch models or Prisma.
4. **Services** hold the rules, and never import Express or Prisma. Anything else that needs the same logic, such as a scheduled reminder job or a mobile client, calls the service directly. When a rule is broken, a service throws a `ServiceError` with a code (`services/errors.ts`).
5. **Models** are the only code that reads or writes the database, one file per table or group of tables. With Prisma they're functions (`findHouseholdByInviteCode`, `createMembership`), not classes; the tables themselves are defined in `prisma/schema.prisma`. A write that breaks a unique rule throws `UniqueConflictError` (`models/errors.ts`), so services don't need to know Prisma's error codes. `models/accounts.ts` reaches Better Auth's tables through Better Auth, so passwords are stored exactly as sign-up stores them.
6. **db.ts** creates the one shared Prisma client.

**Tests by layer:** route tests go through the whole app with in-memory models (`server/test/fakeModels.ts`, typed against the real model functions so it can't drift). Service tests use the same fake models, or stub a model module. Model tests check the actual Prisma queries against a stub client. The e2e tests cover the real database.

**Conventions confirmed in Spike 1:**

- Relative imports in `api/`, `server/` and `shared/` end in `.js` (for example `../server/app.js`). TypeScript maps them to the `.ts` files, and Vercel compiles each `.ts` file to `.js`. React code in `src/` uses Vite's style (`./App.tsx`).
- Types shared by the frontend and the API live in `shared/api.ts` for now; Zod schemas join them once the team confirms Zod.
- The Prisma client is generated into `server/generated/prisma/` (git-ignored) by `postinstall` and again by the `build:vercel` script.
- Prisma packages are pinned to exactly `7.10.0`. npm's `latest` tag for `prisma` points to an 8.0 release candidate, so don't upgrade without pinning.
- The Vercel build script is named `build:vercel`, not `vercel-build`. Vercel's Node runtime runs a script called `vercel-build` on its own while building the `api/` function, so with that name the migrations and frontend build ran twice.

`vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build:vercel",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

The first rewrite sends all API paths to the Express function. The second lets React Router handle all other paths. `framework` and `outputDirectory` are set here because the Vercel project's dashboard preset is "Other". `build:vercel` runs `prisma generate && prisma migrate deploy && npm run build`. Spike 1 confirmed this setup (PR #4).

### Local development

- `npm run dev` starts Vite (port 5173) and `server/dev.ts` (port 3000, through `tsx watch`) together. Vite forwards `/api` requests to Express.
- Each developer connects to a shared **Neon dev branch**, never to production data.
- An `.env.example` file lists the required variables. Real values stay out of git.

---

## 4. MVP scope (cycle 1)

In scope:

1. Sign up, log in and log out (email and password).
2. Create a household, or join one with an invite code.
3. Add a chore with a name, an assignee and a due date (today or later), plus optional notes. **Built** (SCRUM-6).
4. View the household's chore list, showing who it's assigned to, when it's due and whether it's done, with an All / Mine filter and this week's progress. **Built** (SCRUM-7), except tapping a row to expand it, which has no design yet.
5. Mark a chore complete, and undo that. Only the chore's assignee can. **Built** (SCRUM-8).
6. Edit or delete a chore. Not built: no screens are designed yet.

Where the stories, Figma and the build disagree, the README's "Conflicts to resolve" section lists each case, the decision and what's built.

Out of scope for the MVP: email of any kind, password reset by email, recurring chores, automatic assignment, availability, notifications and multiple households per user.

---

## 5. Data model

Better Auth reads and writes its own tables: `user`, `session`, `account` and `verification`. They're defined in `prisma/schema.prisma`, generated with `npx auth@latest generate`, so Prisma migrations create them like any other table. User ids are text, not uuid. Passwords are stored hashed, in `account.password`. Our tables:

**Household**
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| name | text | for example, "Packard St House" |
| inviteCode | text, unique | short random code; can be regenerated |
| createdAt | timestamp | |

**Membership**
| Field | Type | Notes |
|---|---|---|
| userId | FK → user (text) | deleting a user deletes their membership |
| householdId | FK → Household | |
| role | enum: `owner`, `member` | the owner can regenerate the invite code and remove members |
| joinedAt | timestamp | |
| | | unique on `userId` in the MVP (one household per user) |

**Chore** (migration `20261029032115_add_chores`)
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| householdId | FK → Household | every query filters on this; deleting the household deletes its chores |
| name | varchar(60) | required (SCRUM-6) |
| notes | varchar(200), nullable | |
| assigneeId | FK → user, nullable | required when the chore is made; null only if that account is deleted later |
| dueDate | date | required; a calendar day with no time |
| completedAt | timestamp, nullable | set when the assignee marks it done; cleared on undo |
| completedById | FK → user, nullable | who marked it done (always the assignee today) |
| createdById | FK → user, nullable | null if that account is deleted later |
| createdAt / updatedAt | timestamp | |
| | | indexes on (householdId, dueDate) and (householdId, completedAt) |

**Status isn't stored.** It's worked out from the dates, in the phone's own time zone (`src/chores.ts`):

| Status | Rule | Shown as |
|---|---|---|
| To do | not done, due today or later | no chip |
| Overdue | not done, due date has passed | Overdue chip, yellow card |
| Done | done on or before the due date | Done chip |
| Late | done after the due date | Late chip |

**Completion lives on the chore**, not in a separate completions table (the earlier draft). One
chore has at most one completion, so two columns are simpler, and the team agreed we can migrate
later. A `ChoreCompletion` table is the likely change when recurring chores, or a history of who did
what for the research, are needed.

---

## 6. API

Every route except `/api/auth/*` and `/api/health` requires a session. **Authorization rule:** every chore and household query is limited to the household the current user belongs to. A user should never be able to read or change another household's data by guessing an ID.

| Method | Path | Purpose |
|---|---|---|
| * | `/api/auth/*` | Better Auth (sign up, sign in, sign out, session) |
| POST | `/api/password-reset` | **stand-in**: set a new password with only `{ email, newPassword }` (TECH_DEBT #7) |
| GET | `/api/health` | uptime check |
| GET | `/api/me` | current user and their household (if any) |
| POST | `/api/households` | create a household; the creator becomes the owner |
| POST | `/api/households/join` | join a household with `{ inviteCode }` |
| GET | `/api/households/current` | household details and members |
| POST | `/api/households/current/invite-code` | regenerate the invite code (owner only) |
| GET | `/api/chores?since=YYYY-MM-DD` | the household's chores: every open one, plus those done or due since `since` (the app sends the Monday of this week). Without `since`, the last 8 days |
| POST | `/api/chores` | add a chore: `{ name, assigneeId, dueDate, notes? }` |
| GET | `/api/chores/:id` | one chore |
| POST | `/api/chores/:id/complete` | mark it done (assignee only; repeating it changes nothing) |
| DELETE | `/api/chores/:id/complete` | undo it (assignee only) |
| PATCH | `/api/chores/:id` | edit a chore. **Not built** (no design yet) |
| DELETE | `/api/chores/:id` | delete a chore. **Not built** (no design yet) |

`GET /api/me` isn't built; `GET /api/households/current` and Better Auth's session cover it.

**Chore rules** (`server/services/chores.ts`, messages from SCRUM-6):

- Name 1–60 characters, notes up to 200, the assignee must be in your household, and the due date can't be in the past.
- "The past" depends on the phone's time zone, which the server doesn't know. The app checks it exactly ("today or later" on the phone). The server only refuses dates before **yesterday in UTC**, which no time zone's "today" can be.
- Chores are only ever looked up inside the current user's household; another household's chore id answers 404 `CHORE_NOT_FOUND`, the same as a made-up one.
- Every chore response has the same shape: `ChoreResponse` in `shared/chores.ts` (people as `{ userId, name }`, `dueDate` as `"YYYY-MM-DD"`).

Responses are JSON. Errors use the format `{ "error": { "code": "...", "message": "..." } }` with the matching HTTP status code. The frontend reacts to the error `code`, not the status.

### Status codes

Named in `shared/httpStatus.ts` (`HttpStatus.CREATED` rather than `201`) and used by both the API and the frontend.

**Success**

| Endpoint | Status |
|---|---|
| `POST /api/households` | **201 Created**, with `Location: /api/households/current` |
| `POST /api/households/join` | **201 Created** with `Location` when it adds the user; **200 OK** when they were already in that household (a repeat tap) |
| `GET /api/households/current`, `POST …/invite-code`, `GET /api/health` | **200 OK** |
| `POST /api/chores` | **201 Created**, with `Location: /api/chores/<id>` |
| `GET /api/chores`, `GET /api/chores/:id`, `POST` and `DELETE /api/chores/:id/complete` | **200 OK**, with the chore (or `{ chores }`) |
| `POST /api/password-reset` | **204 No Content** |

**Errors** (the same on every endpoint)

| Status | When | Error codes |
|---|---|---|
| **400 Bad Request** | The request itself is malformed | `INVALID_JSON`, `BAD_REQUEST` |
| **401 Unauthorized** | Nobody is signed in. Checked before anything else about the request | `UNAUTHENTICATED` |
| **403 Forbidden** | Signed in, but not allowed (for example, a member changing the invite code, or marking someone else's chore done) | `FORBIDDEN`, `NOT_ASSIGNEE` |
| **404 Not Found** | The URL names something that doesn't exist: an unknown route, "your household" when you have none, or a chore that isn't in your household | `NOT_FOUND`, `NO_HOUSEHOLD`, `CHORE_NOT_FOUND` |
| **405 Method Not Allowed** | The path exists, but not with this method. The `Allow` header lists the methods it takes | `METHOD_NOT_ALLOWED` |
| **409 Conflict** | The request clashes with the current state | `ALREADY_IN_HOUSEHOLD` |
| **413 Content Too Large** | The body is over the size limit | `PAYLOAD_TOO_LARGE` |
| **415 Unsupported Media Type** | A body that isn't JSON | `UNSUPPORTED_MEDIA_TYPE` |
| **422 Unprocessable Content** | Well-formed JSON whose values break a rule, including values that point at nothing (an unknown invite code or email) | `VALIDATION_ERROR`, `PASSWORD_INVALID`, `INVITE_CODE_NOT_FOUND`, `ACCOUNT_NOT_FOUND`, `DUE_DATE_IN_PAST`, `ASSIGNEE_NOT_IN_HOUSEHOLD` |
| **429 Too Many Requests** | Too many sign-ins or sign-ups (Better Auth's limit) | (Better Auth's own body) |
| **500 Internal Server Error** | A bug or an unexpected failure; details go to the server log, never the response | `INTERNAL_ERROR` |
| **503 Service Unavailable** | `GET /api/health` couldn't reach the database | `DATABASE_UNAVAILABLE` |

Services report broken rules as `ServiceError` codes; `middleware/errors.ts` holds the one table that maps each code to its status. A new code won't compile until it has a status there.

---

## 7. Environment and configuration

| Variable | Set by | Used for |
|---|---|---|
| `DATABASE_URL` | Neon integration | pooled connection for the app at runtime |
| `DATABASE_URL_UNPOOLED` | Neon integration | direct connection for Prisma migrations |
| `BETTER_AUTH_SECRET` | us (random 32+ bytes), separate values for local, Preview and Production | signing session cookies. Better Auth refuses to start on Vercel without it |

No `BETTER_AUTH_URL`: every preview has a different URL, so `server/auth.ts` lets Better Auth take its URL from each request's host instead. It only accepts our own hosts: `si526-team.vercel.app`, `si526-team-si-526.vercel.app` and `si526-team-*-si-526.vercel.app` on Vercel, and `localhost` locally.

**Environments:**

| Environment | Database |
|---|---|
| Production (`main` branch) | Neon `main` branch |
| Preview deployments (pull requests) | Its own Neon branch (`preview/<git-branch>`), copied from main and deleted after merge |
| Local development | Neon `dev` branch |

**Current state (2026-10-01):** the Neon integration sets the `jaals-db` connection variables for Production and Preview only. Development is turned off, so local machines use `.env` (the `dev` branch) and `vercel env pull` brings in no database credentials. Setup steps:

- [x] Create a `dev` branch in the Neon console (done: `dev` is a child branch of `jaals-db` main).
- [x] Point local `.env` files at the `dev` branch, using both its pooled and its direct connection strings. Verified 2026-10-01: both connect, and the server runs PostgreSQL 18.6. New teammates copy `.env.example` to `.env`.
- [x] Connect the integration to Production and Preview, with Development off.
- [x] Turn on "create database branch for deployment" for Preview (off for Production).
- [x] Confirm that a preview deploy creates a `preview/<branch>` branch in Neon. Verified with PR #1, which created `preview/setup/tech-spec`.
- [x] Check that Neon deletes the preview branch after merge. **It does not.** Our integration is Vercel-managed, so Neon deletes a preview branch only when its last Vercel deployment is deleted. On Hobby that happens after the 30-day default retention, not when the pull request closes.
- [x] Add a GitHub Action (`.github/workflows/neon-preview-cleanup.yml`) that deletes `preview/<branch>` when a pull request closes. It reads the `NEON_PROJECT_ID` and `NEON_API_KEY` repository secrets.
- [x] Set Vercel's **Deployment Retention Policy → Pre-Production Deployments** to 1 day as a backstop.

The integration also sets `POSTGRES_*` and `PG*` aliases. We use only `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.

**Migrations** run with `prisma migrate deploy` as part of the Vercel build, against the direct (unpooled) connection.

---

## 8. Deferred: email and reminders

Email is not needed for the MVP. When a later cycle needs it (reminders, password reset or invites):

- **Provider: Brevo (free tier, about 300 emails/day).** It can send from a single verified sender address without a custom domain, which suits us because we're staying on `*.vercel.app`.
- **Ruled out:**
  - Resend needs a verified domain before it will send to anyone other than the account owner.
  - SendGrid no longer has a free plan.
  - Mailgun's free sandbox only sends to pre-approved addresses.
- **Deliverability risk:** without our own domain, mail is more likely to land in spam. If that becomes a problem, buying a domain (about $10/year) and switching to Resend fixes it.
- **Scheduling reminders:**
  - Vercel Hobby cron jobs run at most once a day. That is enough for a daily digest.
  - For anything more frequent, a scheduled GitHub Actions workflow can call a protected `/api/cron/...` endpoint, at no cost.
- **Until then, password reset is manual.** A developer resets the password with a script. This is acceptable for about 10 research participants.

---

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Vercel Hobby is single-user, so only the owner can see the dashboard, env vars and logs | Others can't debug production on their own | Anthony owns the Vercel project; document env vars in `.env.example`; every pull request gets a preview URL anyone can open |
| Neon cold start after idle | First request takes about 1 second longer | Acceptable at our scale; optionally warm `/api/health` before research sessions |
| Stale Neon preview branches pile up and hit the free plan's branch limit | New pull requests deploy without a preview database | GitHub Action deletes each preview branch when its pull request closes; shorter Vercel preview retention as a backstop |
| Free-tier limits (Neon storage and compute hours, Vercel function usage) | Service throttled or paused | Our usage is orders of magnitude below the limits; check the dashboards monthly |
| Running Express inside a Vercel Function (rewrites, cold starts, Prisma bundling) | Deployment issues | **Spike 1**, before any feature work |
| Better Auth URL and cookie settings across preview URLs | Login fails on previews | Better Auth takes its URL from each request's host, limited to our own Vercel hosts (section 7). Verified on a preview in Spike 2 |
| Stand-in password reset needs only an email (TECH_DEBT #7) | Anyone who knows a housemate's email can take over their account | Acceptable while users are the team and participants; replace with Better Auth's emailed reset when email is added |
| Data leaking between households | Privacy problem | Enforce the household check in one middleware; add API tests that try to access another household's data |
| Team members new to React, Express or TypeScript | Slower cycle 1 | Keep the MVP small; pair on the first routes and components; use plain `fetch` and avoid extra libraries; allow `any` while learning, with a lint warning rather than an error |
| No email means no self-service password reset | Participants get locked out | Manual reset script; add email in a later cycle if research shows it's needed |

---

## 10. Feasibility spikes (to finish before cycle 1 build work)

- [x] **Spike 1: deploy skeleton.** A Vite + React + TypeScript page and an Express `/api/health` route that reads one row from Neon through Prisma, deployed to Vercel. Confirms the rewrites, TypeScript function bundling (including imports from `shared/`), pooled connection and that migrations run during the build. Done 2026-10-01 in PR #4. One fix was needed: the build script was renamed from `vercel-build` to `build:vercel` because Vercel's Node runtime runs `vercel-build` by itself, which made the build run twice.
- [x] **Spike 2: auth round trip.** Better Auth sign-up, sign-in and session check working locally and on a preview URL.
  - [x] Locally (2026-10-17, branch `Sprint2_Dev`, Better Auth 1.7.10). Checked with curl through the Vite proxy and in a browser: sign-up sets an `HttpOnly` session cookie, the session reads back, a signed-in user can create a household, sign-out makes protected routes answer 401, a wrong password gets 401, signing in again restores the session, and a sign-up from another site gets 403 `INVALID_ORIGIN`.
  - [x] On a preview (2026-10-17, commit `db9eb49`). `BETTER_AUTH_SECRET` is set in Vercel as a hidden secret, with separate values for Preview and Production. The preview build applied the auth migration to the preview's own Neon branch; main was untouched. The same checks passed on both the deployment URL and the branch URL (`si526-team-git-sprint2dev-si-526.vercel.app`). On Vercel the session cookie is `__Secure-better-auth.session_token` (`HttpOnly`, `Secure`). Better Auth's sign-in rate limit also kicked in (429) after a burst of rapid requests.
  - Previews are **not** behind Vercel's login: anyone with a preview URL can open it and sign up. That's fine for test data, but don't share preview links outside the team.
- [x] **Spike 3: team deploy check.** A teammate (not the Vercel owner) pushes a branch and confirms a preview deployment builds. Passed 2026-10-01: PR #5 (`shivapa-lang`) and PR #6 (`eggbao`) both built Vercel previews. Feature PRs #8 and #9 from the same teammates built previews too (2026-10-14). On the free plan, commits from people other than the Vercel owner deploy fine as long as the repo is public.

---

## 11. Open questions

- One household per user for the MVP? This spec assumes yes; the Membership table allows more later.
- Should anyone in a household be able to edit or delete any chore, or only its creator and the household owner? This needs UX and PM input. (Decided for marking done: only the assignee.)
- Recurring chores: are they needed in cycle 1? Discovery research should decide.

---

## 12. Setup status (feasibility review tracker)

Last checked: 2026-10-01.

| Area | Status | Notes |
|---|---|---|
| GitHub repo (`antshep-umich/si526-team`, public) | Done | Branch protection on `main`: pull requests need 1 approval, and admins can bypass |
| Collaborators | In progress | `eggbao` and `BingganRen` accepted; `jcha28` and `shivapa-lang` haven't accepted their invites yet |
| Vercel project (`si-526/si526-team`, Hobby) | Done | Production deploys from `main`; every pull request gets a preview |
| Vercel pre-production retention | Done | Set to 1 day |
| Neon database `jaals-db` (Postgres 18.6) | Done | Branches: `main` (production) and `dev` (local development) |
| Neon ↔ Vercel integration | Done | Production and Preview only; Development is off |
| Preview database branches | Done, verified | PR #1 created `preview/setup/tech-spec` |
| Preview branch cleanup | Done, verified | PR #2's workflow deleted its preview branch on merge |
| GitHub Actions secrets | Done | `NEON_PROJECT_ID` and `NEON_API_KEY` (both stored as repository secrets) |
| Local `.env` connected to the `dev` branch | Done, verified | On both of Anthony's machines |
| Spike 1: deploy skeleton | Done, verified | PR #4: preview served the page, `/api/health` read Neon through Prisma, and the build applied the first migration |
| Spike 2: auth round trip | Done, verified | Locally and on a preview (`Sprint2_Dev`); see [section 10](#10-feasibility-spikes-to-finish-before-cycle-1-build-work) |
| Spike 3: team deploy check | Done, verified | PRs #5 and #8 (`shivapa-lang`) and #6 and #9 (`eggbao`) all built Vercel previews |
| Tests workflow (`tests.yml`) | Done | Typecheck and tests on every push and on pull requests into `main`, then publishes the dashboard. The publishing part first ran on 2026-10-28 |
| Test dashboard (GitHub Pages) | In progress | The `gh-pages` branch exists (2026-10-28); Pages isn't turned on yet ([section 15](#15-testing-ci-and-the-test-dashboard)) |
| Required test check on `main` | Not set up | Add once the workflow has run on a pull request |

### Next steps

1. Merge `Sprint2_Dev` to `main` when the sprint's ready. Production then gets the auth tables and sign-in; its `BETTER_AUTH_SECRET` is already set.
2. Build the chore features (MVP items 3 to 6 in [section 4](#4-mvp-scope-cycle-1)), plus a join-household screen.
3. Get the team to confirm or change the *Proposed* rows in [section 2](#2-decisions), and answer [section 11](#11-open-questions).
4. Turn on the test dashboard and the required test check ([section 15](#15-testing-ci-and-the-test-dashboard), "One-time setup").

---

## 13. Repository workflow

- **Nobody commits directly to `main`.** All work goes on a branch and is merged through a pull request with 1 approval. The repo owner can bypass the approval for setup-only changes.
- **Branches.** Each person works on their own dev branch (for example `louise-dev`) and pushes to it directly, as often as they like. There's no naming prefix. Pull requests are only for merging a dev branch into `main`, never into another branch.
- **Tests run on every push** to any branch, and again on each pull request into `main` against what `main` would look like after the merge (see [section 15](#15-testing-ci-and-the-test-dashboard)).
- **Merging and history.** We use merge commits, so every commit from a branch stays in `main`'s history. GitHub deletes the branch automatically after merge ("Automatically delete head branches"). Deleting a merged branch loses nothing: the commits are in `main`, the pull request page keeps the full diff and discussion, and the branch can be restored from the pull request with one click. To keep working after a merge, create your branch again from the updated `main`; the same name is fine.
- **Each pull request gets its own preview database** (`preview/<branch>`), copied from main. It's deleted when the pull request closes.
- **Commit identity.** In this repo, set your git email to the address on the GitHub account that has access to the repo, so commits are credited to that account. Anthony uses `antshep@umich.edu`.

---

## 14. Setting up a new machine

The repo contains no secrets, so `.env` has to be copied over separately.

1. **Install the tools:** Node.js 24 LTS, git, the GitHub CLI (`gh`) and the Vercel CLI (`npm i -g vercel`).
2. **Sign in to GitHub** as the account that has access to the repo:
   ```
   gh auth login
   gh auth switch --user <your-school-account>   # only if you have more than one account
   gh auth setup-git
   ```
3. **Clone the repo and set your commit identity:**
   ```
   gh repo clone antshep-umich/si526-team
   cd si526-team
   git config user.email <your-school-email>
   ```
4. **Create `.env`.** Copy `.env.example` to `.env` and fill in the `dev` branch connection strings. They're in the Neon console (Vercel → Storage → jaals-db → **Open in Neon** → Branches → `dev` → Connect), or Anthony can send them. Also set `BETTER_AUTH_SECRET` to a random string of 32+ characters; `.env.example` shows a command that makes one. Never commit `.env`.
5. **Vercel CLI (repo owner only, optional):** run `vercel login` as `antshep-umich`, then `vercel link` and choose the `si-526` team and the `si526-team` project.
6. **Install and run:** `npm install` (this also generates the Prisma client), then `npm run dev`. Open http://localhost:5173 and you should see the Log in screen. Run `npm test` for the unit tests. For the end-to-end tests, run `npx playwright install chromium` once, then `npm run test:e2e`.

---

## 15. Testing, CI and the test dashboard

The tests are also our evidence that Jira stories' acceptance criteria (ACs) are met, especially ones the UI can't show (for example, "a user can't be in two households"). The **test dashboard** at https://antshep-umich.github.io/si526-team/ shows the latest results, history, and the stories whose ACs our tests check. It doesn't replace Jira, which is still where stories are tracked. It's an internal page laid out for a desktop browser, but it's public like the repo, so nothing secret belongs in test names, AC text or commit messages.

### What runs when

The `Tests` workflow (`.github/workflows/tests.yml`) runs the typecheck and the `server`, `web` and `scripts` test projects, the same ones as `npm test`. End-to-end tests aren't part of it; they run against each preview deployment (`e2e-preview.yml`).

| Event | Tests run on | Goes on the dashboard as |
|---|---|---|
| Push to any branch except `main` | The pushed commit | That branch's row under "Branches in progress" (replaced on each push) |
| Pull request into `main` opened or updated | The merge result (branch + current `main`) | Nothing; it's the pull request's check |
| Pull request merged | The branch's final commit | A row under "Merged branches", kept permanently |
| Push to `main` (each merge) | The new `main` | The latest result, the chart, the Stories section and `main`'s history |

Failing runs are published too. A run whose typecheck or tests failed, or whose AC files or tags have problems, fails its check. Every run uploads `test-report` (results, summary and HTML report) and `test-report.html` (the HTML report alone) as artifacts for 30 days.

### Acceptance criteria and tags

- **One file per Jira story** in `acceptance/`, named after its key (`acceptance/SCRUM-18.json`): the key, the title, optionally its `epic` (`{ "key": "SCRUM-10", "title": "Households" }`), and each AC's `id` (`AC1`, `AC2`, ...), its `text` as written in Jira, and `verify`: `test` or `manual` (with a `note` saying how it's shown, for example a visual check in the demo). `acceptance/README.md` has an example.
- **Tag the tests** that prove a story's ACs with its key, `{ tags: ["SCRUM-18"] }`, usually on the `describe` block, and **start each such test's name with its AC id**: `"AC2: refuses a second household for the same user"`. One test can cover several ACs (`"AC1, AC3: ..."`). Supporting tests keep plain names.
- **Write tests from the AC text, not from the code.** If the code doesn't meet an AC, the test should fail and stay failing until the code is fixed.
- **Checks.** Vitest only accepts tags that have an AC file, so a mistyped key fails the run. The summary step also fails the check when a test names an AC but has no story tag (or more than one), or names an AC id the story doesn't have.
- **AC statuses:** *passing* (all its tests passed), *failing* (any failed), *no test yet* (a `test` AC with no tests that ran) and *manual*.
- **The Stories section** nests epics → stories → ACs, from the latest run on `main`. Each story gets a verdict: *Accepted* (every AC passing or manual), *Not accepted* (an AC failing) or *Incomplete* (an AC with no test yet). Accepted stories start collapsed, and so does an epic whose stories are all accepted. Stories without an epic come last.
- **Box-with-arrow links** on each epic, story and AC open the run's Vitest report in a new tab, filtered to those tests; an AC's link also opens its test. The report keeps its search in local storage (key `vitest-ui_task-tree-filter`, Vitest 5), so the dashboard writes the filter there just before opening it, and its plain "Open report" links clear it. If a Vitest upgrade renames that key, the links still open the report, unfiltered.
- **Any test can prove an AC:** a `server` test for API rules, or a `web` component test (jsdom + Testing Library) for screen behavior. End-to-end tests aren't in the report, so an AC only an end-to-end test can show is marked `manual` with a note pointing to that test.

### Running it locally

    npm test             # server + web + scripts
    npm run test:ui      # the same tests in a browser page
    npm run test:report  # tests, then a local copy of the dashboard

`npm run test:report` writes `test-report/` (git-ignored) and prints the path of the local dashboard. It adds each run to the same local history, so running it twice gives two bars in the chart.

### How publishing works

- The `publish` job runs `scripts/test-report/publish.ts`. It reads the `gh-pages` branch, adds the run to `data/history.json`, copies in the run's HTML report, re-renders `index.html`, and replaces `gh-pages` with a single new commit. It pushes with `--force-with-lease`, so if another run published first, it starts over from the new state instead of overwriting it.
- **Kept:** every `main` row forever, with full reports for the newest 30; the latest run of each branch that still exists (deleted branches drop off); every merged pull request's final run and report. Each report is about 1 MB.
- Only the workflow writes to `gh-pages`. Don't push to it by hand.
- Pull requests from forks are tested but never published.

### One-time setup (repo owner)

1. **Turn on Pages** after the first push that runs the workflow has created `gh-pages`: Settings → Pages → Build and deployment → Source: *Deploy from a branch*, Branch: `gh-pages`, folder `/ (root)`.
2. **Require the test check** once the workflow has run on a pull request: in the branch protection for `main`, turn on "Require status checks to pass" and add the `Tests` check.
