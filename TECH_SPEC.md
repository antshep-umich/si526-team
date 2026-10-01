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
| Testing | Vitest (unit tests), Supertest (API tests) | Proposed |
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

### Repo layout (proposed)

```
/
├── api/
│   └── index.ts          # Vercel entry point: imports and exports the Express app
├── server/
│   ├── app.ts            # builds the Express app (routes, middleware); no app.listen
│   ├── dev.ts            # local only: imports app and calls app.listen(3000); run with tsx
│   ├── auth.ts           # Better Auth config
│   ├── db.ts             # Prisma client (single shared instance)
│   └── routes/           # households.ts, chores.ts, ...
├── shared/
│   └── schemas.ts        # Zod schemas and types used by both the frontend and the API
├── prisma/
│   └── schema.prisma
├── src/                  # React app, .tsx (Vite default location)
├── public/
├── index.html            # Vite entry point
├── vite.config.ts        # dev proxy: /api → http://localhost:3000
├── tsconfig.json         # strict mode on
├── vercel.json           # rewrites (see below)
└── package.json          # one package.json for client and server
```

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
3. Add a chore, with an optional assignee and an optional due date.
4. View the household's chore list, showing who it's assigned to, when it's due and whether it's done.
5. Mark a chore complete, and undo that.
6. Edit or delete a chore.

Out of scope for the MVP: email of any kind, password reset by email, recurring chores, automatic assignment, availability, notifications and multiple households per user.

---

## 5. Data model (draft)

Better Auth creates and manages its own tables: `user`, `session`, `account` and `verification`. Our tables:

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
| userId | FK → user | |
| householdId | FK → Household | |
| role | enum: `owner`, `member` | the owner can regenerate the invite code and remove members |
| joinedAt | timestamp | |
| | | unique on `userId` in the MVP (one household per user) |

**Chore**
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| householdId | FK → Household | every query filters on this |
| title | text | required |
| notes | text, nullable | |
| assigneeId | FK → user, nullable | null means unassigned |
| dueDate | date, nullable | |
| createdById | FK → user | |
| createdAt / updatedAt | timestamp | |

**ChoreCompletion**
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| choreId | FK → Chore | |
| completedById | FK → user | |
| completedAt | timestamp | |

**Why completions are a separate table** instead of a single `isDone` flag on the chore:

- It keeps a history of who did what and when. That is the evidence our research needs, since we plan to measure completion before and after people start using the app.
- It supports recurring chores later without changing the schema.

In the MVP a chore counts as "done" if it has a completion record. Undoing a completion deletes that record.

---

## 6. API (draft)

Every route except `/api/auth/*` and `/api/health` requires a session. **Authorization rule:** every chore and household query is limited to the household the current user belongs to. A user should never be able to read or change another household's data by guessing an ID.

| Method | Path | Purpose |
|---|---|---|
| * | `/api/auth/*` | Better Auth (sign up, sign in, sign out, session) |
| GET | `/api/health` | uptime check |
| GET | `/api/me` | current user and their household (if any) |
| POST | `/api/households` | create a household; the creator becomes the owner |
| POST | `/api/households/join` | join a household with `{ inviteCode }` |
| GET | `/api/households/current` | household details and members |
| POST | `/api/households/current/invite-code` | regenerate the invite code (owner only) |
| GET | `/api/chores` | list the household's chores, including completion status |
| POST | `/api/chores` | create a chore |
| PATCH | `/api/chores/:id` | edit a chore |
| DELETE | `/api/chores/:id` | delete a chore |
| POST | `/api/chores/:id/complete` | mark complete |
| DELETE | `/api/chores/:id/complete` | undo completion |

Responses are JSON. Errors use the format `{ "error": { "code": "...", "message": "..." } }` with the matching HTTP status code.

---

## 7. Environment and configuration

| Variable | Set by | Used for |
|---|---|---|
| `DATABASE_URL` | Neon integration | pooled connection for the app at runtime |
| `DATABASE_URL_UNPOOLED` | Neon integration | direct connection for Prisma migrations |
| `BETTER_AUTH_SECRET` | us (random 32+ bytes) | signing sessions |
| `BETTER_AUTH_URL` | us | the app's base URL for each environment |

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
| Better Auth URL and cookie settings across preview URLs | Login fails on previews | **Spike 2**; configure trusted origins for `*.vercel.app` previews |
| Data leaking between households | Privacy problem | Enforce the household check in one middleware; add API tests that try to access another household's data |
| Team members new to React, Express or TypeScript | Slower cycle 1 | Keep the MVP small; pair on the first routes and components; use plain `fetch` and avoid extra libraries; allow `any` while learning, with a lint warning rather than an error |
| No email means no self-service password reset | Participants get locked out | Manual reset script; add email in a later cycle if research shows it's needed |

---

## 10. Feasibility spikes (to finish before cycle 1 build work)

- [x] **Spike 1: deploy skeleton.** A Vite + React + TypeScript page and an Express `/api/health` route that reads one row from Neon through Prisma, deployed to Vercel. Confirms the rewrites, TypeScript function bundling (including imports from `shared/`), pooled connection and that migrations run during the build. Done 2026-10-01 in PR #4. One fix was needed: the build script was renamed from `vercel-build` to `build:vercel` because Vercel's Node runtime runs `vercel-build` by itself, which made the build run twice.
- [ ] **Spike 2: auth round trip.** Better Auth sign-up, sign-in and session check working locally and on a preview URL.
- [ ] **Spike 3: team deploy check.** A teammate (not the Vercel owner) pushes a branch and confirms a preview deployment builds.

---

## 11. Open questions

- One household per user for the MVP? This spec assumes yes; the Membership table allows more later.
- Should anyone in a household be able to edit or delete any chore, or only its creator and the household owner? This needs UX and PM input.
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
| Spike 2: auth round trip | Not started | |
| Spike 3: team deploy check | Not started | Needs `eggbao` or `BingganRen` to push a branch. This is the biggest remaining unknown |

### Next steps

1. Run Spike 3. It needs no code: a teammate pushes any branch and opens a pull request, and we check that Vercel builds the preview.
2. Run Spike 2 once Spike 1 deploys.
3. Get the team to confirm or change the *Proposed* rows in [section 2](#2-decisions), and answer [section 11](#11-open-questions).

---

## 13. Repository workflow

- **Nobody commits directly to `main`.** All work goes on a branch and is merged through a pull request with 1 approval. The repo owner can bypass the approval for setup-only changes.
- **Branch names** use a prefix and a short description, for example `feat/chore-list`, `fix/login-redirect`, `docs/...` or `ci/...`.
- **Merging and history.** We use merge commits, so every commit from a branch stays in `main`'s history. GitHub deletes the branch automatically after merge ("Automatically delete head branches"). Deleting a merged branch loses nothing: the commits are in `main`, the pull request page keeps the full diff and discussion, and the branch can be restored from the pull request with one click.
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
4. **Create `.env`.** Copy `.env.example` to `.env` and fill in the `dev` branch connection strings. They're in the Neon console (Vercel → Storage → jaals-db → **Open in Neon** → Branches → `dev` → Connect), or Anthony can send them. Never commit `.env`.
5. **Vercel CLI (repo owner only, optional):** run `vercel login` as `antshep-umich`, then `vercel link` and choose the `si-526` team and the `si526-team` project.
6. **Install and run:** `npm install` (this also generates the Prisma client), then `npm run dev`. Open http://localhost:5173; the page should read "API: ok · Database: ok". Run `npm test` for the unit tests.
