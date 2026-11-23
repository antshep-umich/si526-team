# AGENTS.md

Briefing for AI coding agents (and people) working in this repo. Read this first; it should
save you from exploring the codebase. Deeper detail lives in `TECH_SPEC.md` (§ numbers below),
`TECH_DEBT.md` and `README.md`. **If you change anything this file describes, update it in the
same commit.**

_Last updated: 2026-11-23 (SCRUM-73 Schedule), on `Ant-Dev-Schedule`._

## The project

A shared chore tracker for people who live together (SI 526, Team JAALS: Jennifer, Shivani,
Ankun, Anthony, Louise). People sign up, create or join a **household** with an invite code,
add chores, see the household's chore list and mark their own chores done.

- **Requirements:** the Jira stories at https://jaals.atlassian.net (project SCRUM; readable through the Atlassian MCP, read-only). `JAALS Stories.txt` one folder above the repo is an older export: SCRUM-6, 7 and 8 have changed since. Where stories disagree with Figma or the build, the decision is recorded in README "Conflicts to resolve", and in `acceptance/` an AC whose text was corrected to a team decision carries a `note` until Jira is updated. If you find a new disagreement, raise it with the user rather than picking a side.

- **Mobile web only** for now (designed at 402×874, the iPhone 17 frame). iOS/Android may come later, which is why the API is a plain JSON API.
- **Light and dark mode follow the device setting** unless the user picks Light or Dark under Appearance on their profile (`src/theme.ts`, kept in the browser, per device). The `/components` dev page has its own switch.
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
npm test               # server + web + scripts unit tests (~10 s, no database)
npm run test:ui        # the same tests in Vitest's browser UI
npm run test:report    # the same tests, then a local copy of the test dashboard in test-report/site
npm run test:e2e       # real browser vs local app + dev DB (run `npx playwright install chromium` once)
npm run build          # what Vercel builds (plus `prisma migrate deploy` and the test household seed in build:vercel)
npm run seed:test-house  # reset the test household (Test_User@test.com) in the dev DB; previews and production get it on every build
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
  seed/                 Test_House_Data: 3 test accounts and dated chores with history (previews, production and the dev DB)
  architecture.test.ts  enforces the layer rules
shared/                 imported by both server and frontend
  api.ts                API response types, apiError(), validation (parseHouseholdName, normalizeInviteCode)
  chores.ts             ChoreResponse and friends, parseChoreName/parseChoreNotes, isIsoDate
  accounts.ts           sign-up rules (name ≤ 30, password ≥ 8 with a number), used by the screens and the server
  preferences.ts        SCRUM-72 chore types (also SCRUM-61's chore categories), weekly workloads and assignment methods, with their parsers
  httpStatus.ts         HttpStatus.CREATED etc. Use these, never bare numbers
src/                    React app
  App.tsx               which screen to show (session + household state machine)
  screens/              one file per Figma screen, plus Screen.tsx (shared layout for the sign-in and household setup screens), TabLayout.tsx (the tab bar under every screen in a household) and Header.tsx (their header: overline, title and the menu); Home.tsx is the chore list and ChoreItem.tsx its card with the dropdown (shared with the Schedule), Schedule.tsx the Schedule tab (SCRUM-73) with ScheduleParts.tsx (its placeholder range bar, week strip and month calendar), ChoreForm.tsx the Add / Edit chore form (AddChore.tsx and EditChore.tsx choose), ChoreHistory.tsx the user's history; House.tsx the House tab (SCRUM-74) and HousemateProfile.tsx its profile placeholder; HistoryParts.tsx the parts all three chore histories share (week/month bar, summary, grouped rows); Profile.tsx your profile and preferences (SCRUM-72, from the header menu), ending with AppearanceSection.tsx and LeaveHouseholdSection.tsx (SCRUM-75)
  chores.ts, dates.ts   chore status/sorting/weekly progress, and "YYYY-MM-DD" dates in the phone's time zone
  history.ts            My chore history's filters, sorts and month groups (SCRUM-44), and the row wording all histories share
  inviteLink.ts         /join/<code> invite links: build one, read it at startup, keep the code until it's used
  theme.ts              System / Light / Dark: the profile's Appearance choice, applied before the first paint
  usePolling.ts         refresh a screen every 10 s while visible (instead of WebSockets)
  useChoreList.ts       the chore list's and the Schedule's chores: load from a date, poll, tick and untick in place
  choreFilter.ts        All / Mine, one remembered choice for the Chore List and the Schedule
  schedule.ts           SCRUM-73: weeks and months, each day's count and overdue mark, the selected day's chores
  useHouseholdNotices.ts  SCRUM-75: shows "[Name] left the household." once to each housemate (polls the notices)
  suggestions.ts        SCRUM-64: Assigned to's "Suggested" / "Everyone else" options from preferences and open chores
  monthlyHistory.ts     Household chore history by month: which chores and the summary (SCRUM-47)
  components/           design-system components (from Figma), each with a .module.css; Toast.tsx (ToastProvider + useToast) is a placeholder, not in Figma; Collapse.tsx rolls any dropdown down and up
  styles/               tokens.css (colors, type), fonts.css, base.css
  api/                  fetch helpers that never throw: return { ok: true, … } | { ok: false, code }
  auth.ts               Better Auth React client (authClient)
  demo/                 /components.html dev page (every component, theme switch, sizes)
e2e/                    Playwright tests driven by Vitest
acceptance/             <JIRA-KEY>.json: each story's acceptance criteria (see Testing)
scripts/test-report/    test results reporter, AC coverage, and the test dashboard site (TECH_SPEC §15)
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

- Tables: `Household` (uuid id, name, unique `inviteCode`, `assignmentMethod`), `Membership` (unique `userId` = one household per user for now; role `owner` | `member`; the member's `choreTypes`, `weeklyWorkload` and `noticesSeenAt`), `Chore` (name, notes, optional `category`, assignee, date-only `dueDate`, `completedAt`/`completedById`, creator), `HouseholdNotice` (`member_left` + the person's name, shown once to each member), plus Better Auth's `user`, `session`, `account`, `verification`.
- **Leaving** (SCRUM-75, `removeMembership` in `models/memberships.ts`, one transaction): open chores become unassigned (`assigneeId` null, "Unassigned"; while unassigned **anyone** may edit a chore), done chores keep the name, housemates get a notice, and the last member's leaving deletes the household. An owner who leaves isn't replaced (TECH_SPEC §11).
- **Chore status is derived, never stored** (`src/chores.ts`): to do (no chip), overdue (not done, past due), done, late (done after the due date). "Today" is the **phone's** date; the server can't know it, so it only rejects due dates before yesterday in UTC and the app enforces "today or later". Weeks run Monday–Sunday: the progress card counts chores due this week, the Done section lists chores done this week, the to-do list shows every open chore.
- Only a chore's **assignee** can mark it done or undo it (403 `NOT_ASSIGNEE`); others see no checkbox. Chores are looked up inside the membership's household only (404 `CHORE_NOT_FOUND` otherwise).
- Invite codes: 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (`services/inviteCode.ts`). Users can type them in any case with spaces or hyphens.
- Neon branches: `main` = production, `dev` = local development (`.env`), and one throwaway `preview/<git-branch>` per Vercel preview. Vercel builds run `prisma migrate deploy`, so a migration in a pull request runs on that pull request's preview database only. Preview and production builds then reset a test household, Test_House_Data (`server/seed/`; sign in as `Test_User@test.com`, password in `testHouse.ts`), with chores dated from that day. Production has it for demos (Anthony, 2026-11-19); it never touches a household real people joined. Leave its three accounts out when counting production users or chores.

## Frontend (TECH_SPEC §3, README "Design system")

- **No router.** `src/App.tsx` picks the screen: signed out → Log in / Sign up / Forgot password; signed in without a household → Your household / Create / Join; just created → Household Created!; otherwise → Home (the chore list), which opens Add chore, and from each chore's dropdown (the chevron) its history and, for the owner or the chore's creator, Edit chore; the Schedule tab shows the same cards by day (a week strip or a month calendar), and Edit chore and a chore's history opened from it come back to it where it was; My / Household chore history open from the menu. Every screen in a household sits in `TabLayout`: the tab bar at the bottom (only the screen above it scrolls, never the page, so phone browsers' sliding toolbars can't cover the bar; Firefox for Android did), the same `Header` (overline, title, and the menu as a dropdown list; it gets the menu's actions from `TabLayout`), and no Back links. All three tabs work and always open their first screen (the Schedule: this week, today selected; README Conflicts rows 33, 34 and 55).
- **Invite links** `/join/<code>`: the only address the app reads (`src/inviteLink.ts`, called from `main.tsx`). The code is kept in `sessionStorage` through Log in or Sign up, then Join opens with it filled in; it's dropped once used, on Back, on log out, or if the user already has a household.
- **Polling, not WebSockets:** the chore list, the Schedule and the House tab refresh every 10 s while visible (`usePolling`). Refreshes replace data in place and never show Loading or an error; `useChoreList` drops a refresh that started before a tick or untick.
- **Dropdowns animate:** anything that drops down or rolls up uses `Collapse` (`src/components/Collapse.tsx`), or for the header menu a fade; chevrons turn. All of it stops when the phone asks for reduced motion.
- **Toasts:** `useToast()` from `ToastProvider` (wrapped around the signed-in app). Only for messages a story asks for: "You joined [Household name].", "Invite link copied.", the profile's save confirmations and "[Name] left the household." (README Conflicts rows 9, 41 and 52).
- **Copy comes from the stories.** Error and empty-state messages are the Jira stories' exact words (auth ones in `src/screens/authErrors.ts` `AUTH_MESSAGES`). The current user is always **"You"** (not "Me"). Forms show every error at once.
- **Screens** use `Screen` (`src/screens/Screen.tsx`): 402px max width, 24px sides, 60px top, 40px between items (`tight` = 24px). `Actions` groups a full-width button with the link under it. Errors go on the field they belong to (`TextField error=…`); others go in `FormError`.
- **API helpers** (`src/api/`) never throw: `{ ok: true, household } | { ok: false, code }`. `NETWORK_ERROR` when the server can't be reached. Screens map codes to their own wording.
- **Design system** comes from the Figma file `rTlKUmhGVqZ9wXJUehed8i` ("App Design": pages Colors & Fonts `15:3`, Components `15:2`, Mock up (Sprint 2) `287:49`).
  - Colors and type **only** via tokens in `src/styles/tokens.css` (`var(--color-action-primary)`, `font: var(--type-body)`). Never hard-code a color or font. Token names mirror the Figma variables.
  - Fonts: Libron (serif, committed in `src/assets/fonts/libron`) and Atkinson Hyperlegible Next (sans, npm `@fontsource`).
  - Reuse `src/components/` (Button, TextField with the password eye, TextArea, PickerField, DateField, Chip, ChoreCard, ProgressCard, TabFilter, DoneSection, TabBar, …) before writing new markup. Each component has a `.module.css`; keep sizes exactly as in Figma.
  - Icons have their colors baked in, so each has a light and a dark SVG (`src/assets/icons/{light,dark}`), shown by `ThemedIcon`. A new icon needs both files.
  - Check visual work on `/components.html` (theme switch + "Show sizes").
- Accessibility is tested: label every input, give icon buttons an `aria-label`, use real buttons.

## Testing (README "Tests")

| Project | Files | Notes |
|---|---|---|
| `server` | `server/**/*.test.ts`, `shared/**/*.test.ts` | Route tests use `createApp({ getSessionUser })` with an `x-test-user` header, and fake models via `vi.mock("../models/households.js", () => import("../test/fakeModels.js"))` (same for memberships and chores). `fakeModels.ts` is typed against the real models. Chore tests fix the clock with `vi.useFakeTimers({ toFake: ["Date"] })`. |
| `web` | `src/**/*.test.{ts,tsx}` | jsdom + Testing Library. Mock `../auth.ts` and `../api/*.ts` with `vi.hoisted` + `vi.mock`. CSS Module class names are unhashed in tests (`toHaveClass("primary")`). |
| `scripts` | `scripts/**/*.test.ts` | The test dashboard's own scripts (TECH_SPEC §15). Node, run directly with type stripping in CI, so `.ts` imports and erasable syntax only. |
| `e2e` | `e2e/*.e2e.test.ts` | Real Chromium at 402×874. Locally it reuses or starts `npm run dev` and deletes its `@e2e.test` accounts afterwards. `E2E_BASE_URL=<url>` targets a deployment, with sign-ins paced for the rate limit. |

- Find elements by role and visible label (`getByRole("button", { name: "Log in" })`), not class names or test ids. Test files sit next to the code they test.
- **Acceptance criteria (TECH_SPEC §15):** each Jira story's ACs live in `acceptance/<KEY>.json` (optional `epic: { key, title }`; per AC: `id`, `text` as written in Jira, `verify: "test" | "manual"`). The dashboard nests epics → stories → ACs with an Accepted / Not accepted / Incomplete verdict per story; it tracks the ACs tests can prove and doesn't replace Jira. Tests that prove an AC carry the story's tag (`describe("…", { tags: ["SCRUM-18"] }, …)`) and start with the AC id (`it("AC2: …")`). Write them from the AC text, not the code; a failing AC test is a finding, not something to adjust. Vitest rejects tags with no AC file, and the report step fails on an `ACn:` test with no story tag or an unknown AC id.
- CI (`.github/workflows/`): `tests.yml` runs typecheck + the `server`, `web` and `scripts` tests on every push and on pull requests into `main`, then publishes pushes and merged PRs to the test dashboard (GitHub Pages from the `gh-pages` branch, https://antshep-umich.github.io/si526-team/). `e2e-preview.yml` runs the e2e suite against each **preview** deployment (never production).

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

## Current state (2026-11-23)

**Done:** Feasibility spikes 1–3 (Vercel + Express + Prisma deploy, Better Auth, teammate deploys) · design tokens and all Figma components · Sprint 2 screens (SCRUM-2 Sign Up, SCRUM-3 Log in/Log out, SCRUM-4 Create a Household, SCRUM-32 Join a Household) + stand-in Forgot password · household API with member names · six-layer server · status codes · unit, component and e2e tests in CI · test dashboard · **chores**: the `Chore` table, `/api/chores`, the chore list ("Home - Chores (All)") and Add chore ("Home - Add Chore (refined)") screens (SCRUM-6, 7, 8) · sign-up, log-in and join messages and rules aligned with SCRUM-2, 3 and 32 · acceptance files for every Done story (SCRUM-2, 3, 6, 7, 8, 32, 44–47) and every Sprint 4 story (SCRUM-53, 61–64, 73–75; SCRUM-72's is on `Sprint4_Dev_profile`), matched to Jira on 2026-11-19; stories not built yet show as Incomplete on the dashboard · **Sprint 3, SCRUM-44 My chore history** (on `Sprint3_Dev_chore-history`): `GET /api/chores/history`, the history screen from the Home menu with filter, sort and an in-place expanded chore; no Figma design yet (README Conflicts rows 19, 20, 23 and 32) · **SCRUM-47 monthly household chore history** (on `Sprint3_Dev_monthly-history`, built on the SCRUM-46 weekly view): a Weekly / Monthly switch in `HouseholdChoreHistory.tsx`, and `MonthlyChoreHistory.tsx` with month navigation, a completed / incomplete / overdue summary and the chores due that month. It reuses `GET /api/chores?since=` (no new endpoint); no Figma design yet (README Conflicts rows 24–26 and 32). · **Sprint 4 (on `Ant-Dev-Sprint4`):** the tab bar and `Header` on every household screen and the test household (from `chore-history-design`) · **chore history redesign** (on `chore-history-design`): the three chore histories as one family (`HistoryParts.tsx`), with month groups, one week or month bar, and a details card with an activity timeline for a single chore; still no Figma design (README Conflicts rows 19, 24, 32) · **SCRUM-74 House tab** (placeholder design, `docs/superpowers/specs/2026-11-15-house-tab-design.md`): members, a "No Household Manager assigned" card, a profile placeholder, the invite code with a share button (`/join/<code>` links), a toast component, and polling for the chore list and House tab. AC3 waits on SCRUM-62 (its test is skipped); AC8 can't happen (README Conflicts rows 35–36). · **SCRUM-53 Chore details** (Ankun) was a screen, now replaced by **the chore card's dropdown** (SCRUM-7 AC11, Figma "Schedule" 837:1483): the chevron right of the chip rolls down Assigned To, Due date, Status, Last done, Chore Details and "View history", plus a pencil for the household owner or the chore's creator that opens **Edit chore** (`PATCH /api/chores/:id`, `canEditChore` in `shared/chores.ts`; README Conflicts rows 28–32) · everything that drops down or rolls up animates (`Collapse`, row 45) · **SCRUM-72 profile page** (on `Sprint4_Dev_profile`, Figma "User Profile" 637:197): "My profile" in the header menu; name and email with an edit state (name changes through Better Auth's `/update-user`, with our name rule in its hook); chore preferences and weekly workload per member (`GET`/`PUT /api/households/current/preferences`, stored on `Membership`); the household's assigned method (`PUT /api/households/current/assignment-method`, owner only, stored on `Household`). Migration `20261119180000_add_profile_preferences`, written by hand. Nothing assigns chores from the preferences yet (README Conflicts rows 37–43). · **SCRUM-61 preferred chores** (on `Sprint4_Dev_chore-category`, no prototype): the SCRUM-72 chore types are the preferences. The chore form (Add and Edit chore) has an optional "Category (optional)" picker between Chore name and Assigned to (`category` on `POST` and `PATCH /api/chores`, stored on `Chore`); housemates whose chore types include it show "· Prefers this chore" in Assigned to, read from the household's `members[].choreTypes` (README Conflicts rows 46–48). Migration `20261119200000_add_chore_category`, written by hand. · **SCRUM-75 leave a household** (on `Ant-Dev-Sprint4`, no design): "Leave household" at the end of the profile with the story's confirmation rolling down; `DELETE /api/households/current/membership`; household notices (`GET …/notices`, `PUT …/notices/seen`, migration `20261122120000_add_household_notices`) shown as a toast. AC6 and AC7 wait on SCRUM-62 (README Conflicts rows 52 and 54). · **SCRUM-64 assignment suggestions** (same branch): Assigned to in Add and Edit chore lists "Suggested" (housemates whose chore types include the chore's Category, most open chores first, each with "Prefers this chore · N open chores") above "Everyone else"; `PickerField` options take `group` and `detail` (README Conflicts rows 48 and 51). The test household's chores have categories, its accounts have preferences, and one chore is unassigned. · **SCRUM-73 Schedule** (on `Ant-Dev-Schedule`, Figma 837:1483 plus placeholders, `docs/superpowers/specs/2026-11-23-schedule-design.md`): the Schedule tab with Week | Month, All | Mine (shared with the Chore List), a range bar with arrows and Today, a week strip or month calendar with each day's count and an overdue dot, and the selected day's cards (overdue chores also first under today). No new endpoint: `GET /api/chores?since=` from the first day shown (README Conflicts rows 55, 56, 58 and D10). · The Due date's calendar icon opens the calendar in Firefox too.

**Next (MVP, TECH_SPEC §4):**
1. The team reviews README "Conflicts to resolve" (stories vs. Figma vs. build, Figma design issues, placeholder names). Several rows wait on UX designs: a card without a checkbox, the expanded chore row, the toast (placeholder), empty/loading/error states.
2. Edit and delete chores (no screens designed yet; who may do it is TECH_SPEC §11).
3. Gaps found while building Sprint 2:
   - "Your household" has no Log out.
   - Invite codes are 8 characters, but Figma shows 6.
4. Undesigned states (pressed, loading, disabled, empty states, toasts) are listed for UX in the Figma frame "UX Please Read". Code standing in for them has a `Not in Figma yet` or `Not designed yet` comment; search for those before redesigning.

**Known problems:** TECH_DEBT.md (#2 dev without .env, #4 health route tests don't reset their mocks, #5 404 message echoes the URL, #6 rate limit per instance, #7 stand-in password reset).

**Open team questions:** TECH_SPEC §11 (one household per user? who can edit/delete chores? recurring chores in cycle 1?).

## Don'ts

- Don't bypass the layers (the architecture test will fail anyway), and don't take household ids from requests.
- Don't add Tailwind, a UI kit, a router or a state library without a team decision (TECH_SPEC §2).
- Don't hard-code colors, fonts or status numbers.
- Don't change Better Auth's tables by hand or query them with Prisma. Use `models/accounts.ts`.
- Don't put secrets in code, tests, docs or commit messages.
- Don't run e2e tests against production. CI only targets previews.
- Don't push to `gh-pages` by hand. Only the `Tests` workflow writes it, one commit at a time.
