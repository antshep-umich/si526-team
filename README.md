# JAALS Chore Tracker

A shared chore tracker for people who live together, built by Team JAALS (Jennifer, Shivani,
Ankun, Anthony, Louise) for SI 526. Housemates sign up, create or join a household with an
invite code, and keep track of who's doing which chore.

- **Live app:** https://si526-team.vercel.app (the `main` branch)
- **Your branch's preview:** `https://si526-team-git-<branch>-si-526.vercel.app`, always the
  branch's latest push, on its own copy of the database. Vercel lowercases the branch name, turns
  `/` into `-` and drops other symbols, so `Sprint4_Dev_profile` is `sprint4devprofile`. The
  [test dashboard](https://antshep-umich.github.io/si526-team/#branches) links every branch's
  preview, and Vercel's bot comments it on each pull request. Previews are public: keep them
  within the team
- **Design:** Figma "App Design" file (Colors & Fonts, Components, and Mock up pages)
- **Design and decisions in depth:** [TECH_SPEC.md](TECH_SPEC.md) · **Known issues:** [TECH_DEBT.md](TECH_DEBT.md)
- **Test dashboard:** https://antshep-umich.github.io/si526-team/ (results, history and Jira acceptance criteria; see [Tests](#tests))
- **Using an AI coding agent?** Point it at [AGENTS.md](AGENTS.md), a compact briefing written for agents.

It's a **mobile web app**: designed for phones (402×874, the iPhone 17 frame) and it follows the
phone's light or dark setting, unless you choose Light or Dark under Appearance on your profile.

## What works today

- Sign up, log in and log out
- Create a household and get an invite code, or join one with a code or an invite link (`/join/<code>`)
- **House tab:** the household's members, a household manager card (no managers yet), and the invite
  code with a share button that sends an invite link (placeholder design, SCRUM-74)
- **Chores:** add a chore (name, who it's for, due date, notes), see the household's chore list
  with All / Mine, this week's progress, and the chores done this week; the person a chore is
  assigned to can mark it done or undo it. The chore list and the House tab pick up housemates'
  changes every 10 seconds, without a reload
- A stand-in "Forgot your password?" (it doesn't send email yet; see TECH_DEBT #7)
- The full design system from Figma: colors, fonts and components, viewable at `/components`

**Next up:** editing and deleting chores, and the states still waiting on designs (see
[Conflicts to resolve](#conflicts-to-resolve)). See TECH_SPEC section 4.

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, CSS Modules |
| Backend | Express 5 (TypeScript), running as a Vercel Function |
| Database | PostgreSQL on Neon, through the Prisma ORM |
| Sign-in | Better Auth (email and password, cookie sessions) |
| Tests | Vitest, with Supertest, React Testing Library and Playwright |
| Hosting | Vercel (deploys from GitHub), Neon (database) |
| CI | GitHub Actions |

## Getting started

**You need:** Node.js 24, Git, and access to this GitHub repo.

1. **Clone and install**

   ```
   git clone https://github.com/antshep-umich/si526-team.git
   cd si526-team
   npm install
   ```

2. **Create your `.env` file.** Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` and `DATABASE_URL_UNPOOLED`: the Neon **dev** branch connection strings. Ask Anthony; only the project owner can open the Vercel and Neon dashboards (Vercel → Storage → `jaals-db` → Open in Neon → Branches → `dev` → Connect). Use the dev branch, never `main`.
   - `BETTER_AUTH_SECRET`: any random string of 32+ characters. This prints one:
     ```
     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     ```

   `.env` holds secrets and is git-ignored. Never commit it.

3. **Run the app**

   ```
   npm run dev
   ```

   Open http://localhost:5173 and create an account. Everyone shares the dev database, so use any made-up email.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Runs the app locally: the React app on port 5173 and the API on port 3000 (the app forwards `/api` to it) |
| `npm test` | Unit and component tests. Fast, no database needed |
| `npm run test:watch` | The same tests, re-running as you save |
| `npm run test:ui` | The same tests in a browser page where you can browse and re-run them |
| `npm run test:report` | The same tests, then builds a local copy of the test dashboard (it prints where) |
| `npm run test:e2e` | End-to-end tests in a real browser against your local app (see [Tests](#tests)) |
| `npm run typecheck` | Checks TypeScript across the whole project |
| `npm run build` | Builds the app the way Vercel does |
| `npx prisma migrate dev --name <change>` | Records a database schema change as a migration and applies it to the dev database |
| `npx prisma migrate deploy` | Applies migrations other people have added (never resets anything) |
| `npx prisma studio` | Opens a browser view of the dev database |

Before opening a pull request, run `npm run typecheck` and `npm test`. CI runs them too.

## How it fits together

```
Phone browser ──► Vercel ──┬── static files: the React app (src/)
                           └── /api/* ──► Express app (server/) ──► Neon Postgres
                                           └── /api/auth/* handled by Better Auth
```

Vercel serves the React app as static files and runs the whole Express API as one function.
The app and API share a domain, so the sign-in cookie just works and there's no CORS setup.

### Folders

```
src/            React app
  App.tsx         decides which screen to show
  screens/        one file per Figma screen
  components/     design-system components (Button, TextField, ChoreCard, …)
  styles/         design tokens: colors, fonts, text styles
  api/            small functions that call the API
server/         Express API, in six layers (below)
shared/         code both sides use: API types, validation, status codes
prisma/         database schema and migrations
e2e/            end-to-end tests
api/index.ts    the Vercel entry point for the API
```

### The API's six layers

Every API request passes through these in order. Each layer only talks to the one below it, and a
test (`server/architecture.test.ts`) fails if code breaks that rule.

| Layer | Folder | Job |
|---|---|---|
| 1. Middleware | `server/middleware/` | Things many requests share: is someone signed in, which household are they in, turning errors into responses |
| 2. Routes | `server/routes/` | Which URL goes to which controller. Nothing else |
| 3. Controllers | `server/controllers/` | Read the request, call a service, send the response |
| 4. Services | `server/services/` | The app's rules, such as "one household per user" or "only the owner can change the invite code" |
| 5. Models | `server/models/` | The only code that reads or writes the database |
| 6. Database | `server/db.ts`, `prisma/` | The Prisma client, the schema and migrations |

Why bother: rules live in one place, each piece can be tested on its own, and later code (scheduled
reminders, a mobile app) can reuse the services without going through HTTP.

### The API

All responses are JSON. Errors always look like this:

```json
{ "error": { "code": "INVITE_CODE_NOT_FOUND", "message": "No household has that invite code" } }
```

| Endpoint | What it does |
|---|---|
| `POST /api/auth/sign-up/email`, `sign-in/email`, `sign-out`, `GET get-session` | Accounts and sessions (Better Auth) |
| `POST /api/households` | Create a household; you become its owner |
| `POST /api/households/join` | Join a household with an invite code |
| `GET /api/households/current` | Your household and its members |
| `POST /api/households/current/invite-code` | Make a new invite code (owner only) |
| `GET /api/chores?since=YYYY-MM-DD` | Your household's open chores, plus those done or due since that date |
| `POST /api/chores` | Add a chore (`name`, `assigneeId`, `dueDate`, optional `notes`) |
| `GET /api/chores/:id` | One chore |
| `POST /api/chores/:id/complete`, `DELETE …/complete` | Mark a chore done, or undo it (its assignee only) |
| `POST /api/password-reset` | Stand-in password reset |
| `GET /api/health` | Checks the API and database are up |

Status codes follow the HTTP standard: 201 for created, 401 when not signed in, 403 when not
allowed, 422 when the input breaks a rule, and so on. The full table is in TECH_SPEC section 6.
Status numbers in code use named constants from `shared/httpStatus.ts`.

### The frontend

- **Screens** (`src/screens/`) match the Figma mockups. There's no router; `App.tsx` picks the screen from whether you're signed in and whether you're in a household. The only address it reads is an invite link, `/join/<code>` (`src/inviteLink.ts`). Home is the chore list; Add chore opens from it. The House tab is `House.tsx`.
- **Chore logic** (`src/chores.ts`, `src/dates.ts`): a chore's status (to do, overdue, done, late) isn't stored; it's worked out from its dates, using the phone's own date. Weeks run Monday to Sunday.
- **Components** (`src/components/`) are the Figma components, each with its own CSS Module.
- **Styles** come only from design tokens in `src/styles/tokens.css`, named after the Figma variables (for example `--color-action-primary`). Don't hard-code colors or fonts.

## Environments

| Where | Database | When it updates |
|---|---|---|
| Your machine | Neon `dev` branch (from your `.env`) | When you run `npm run dev` |
| Preview (`si526-team-git-<branch>-si-526.vercel.app`) | Its own throwaway copy of production, deleted after the pull request closes | Every push to a branch |
| Production (https://si526-team.vercel.app) | Neon `main` branch | Every merge to `main` |

Vercel runs database migrations as part of each build, so a schema change in a pull request only
touches that pull request's preview database until it's merged. **Preview links are public:** don't
share them outside the team.

### Test household

Every preview and production build resets a household called **Test_House_Data** with chores
dated from the day of the build: some to do, overdue, done and done late, with a few weeks of
history. Production has it so the team can demo the deployed app; it never touches a household
a real person has joined, and nobody else's data changes. Run `npm run seed:test-house` to reset
the same household in the dev database. The code is in `server/seed/`.

| Account | Email | Password |
|---|---|---|
| Test_User (owner; sign in as this one) | `Test_User@test.com` | `password2` |
| Test_Housemate_1 | `Test_Housemate_1@test.com` | `password2` |
| Test_Housemate_2 | `Test_Housemate_2@test.com` | `password2` |

These are made-up test accounts, not secrets. Don't use the password anywhere else. They work on
the production site too, so don't share them with research participants, and leave them out
when counting users or chores in the production database.

## How to…

### …change the database

1. Run `npx prisma migrate deploy` first, so the dev database has everyone else's migrations.
2. Edit `prisma/schema.prisma`.
3. Run `npx prisma migrate dev --name describe-the-change`. It creates the migration and applies it to the dev database.
4. Commit the new folder in `prisma/migrations/` along with your code.

The dev database is **shared by the whole team**. If `migrate dev` says the database has drifted and offers to **reset** it, answer **no**: a reset deletes everyone's test data. Run `npx prisma migrate deploy`, try again, and ask the team if it still complains.

### …add an API endpoint

Work bottom-up through the layers, for example for "rename my household":

1. **Model:** a function that runs the query, in `server/models/households.ts`.
2. **Service:** the rule (who may rename, valid names) in `server/services/households.ts`. If it can fail in a new way, add an error code to `server/services/errors.ts` and its HTTP status to `server/middleware/errors.ts`.
3. **Controller:** read the request, call the service, send the response, in `server/controllers/households.ts`.
4. **Route:** connect the URL to the controller in `server/routes/households.ts`.
5. **Types:** add the response shape to `shared/api.ts` if it's new.
6. **Tests and docs:** add tests next to each file, and add the endpoint to TECH_SPEC section 6.

Look at the existing household files for the pattern; AGENTS.md has the detailed checklist.

### …build a screen

- Lay it out with `Screen` from `src/screens/Screen.tsx`; it applies the Figma spacing.
- Use the components in `src/components/` and the tokens in `src/styles/tokens.css`. Check how they look at http://localhost:5173/components.html.
- Call the API through a helper in `src/api/`. Helpers never throw; they return `{ ok: true, … }` or `{ ok: false, code }`, and the screen picks the message for each code.
- Add the screen to `App.tsx`.

### …add an icon

Export it from Figma in both light and dark mode, since the colors are part of the file. Save the files as
`src/assets/icons/light/<name>.svg` and `src/assets/icons/dark/<name>.svg`, add it to
`src/components/icons.ts`, and use it with `<ThemedIcon name="…" />`.

### …get your work merged

1. Make a branch, commit, and push. Vercel builds a preview, and GitHub Actions runs the tests.
2. Open a pull request into `main`. It needs one approval.
3. Merge it. The branch is deleted automatically, and production updates.

Commit with the email of the GitHub account that has access to the repo (`git config user.email you@umich.edu`).

## Design system

Colors, fonts and text styles come from the Figma "App Design" file and live in `src/styles/tokens.css`.
The two typefaces are Libron (serif, in `src/assets/fonts/libron`) and Atkinson Hyperlegible Next (sans).

To see every component, run `npm run dev` and open http://localhost:5173/components.html (on a
deployment, `/components`). Its System / Light / Dark switch shows either mode, and "Show sizes"
prints each component's size so you can compare it with Figma.

## Tests

All tests use [Vitest](https://vitest.dev), split into four groups:

| Group | Covers | Runs in |
|---|---|---|
| `server` | the API through Express, services, models, middleware, and the layer rules | Node, with in-memory stand-ins instead of a database |
| `web` | components, screens, `App.tsx`'s screen flow, and the API helpers | a simulated browser (jsdom) with React Testing Library |
| `scripts` | the scripts that build the test dashboard (`scripts/test-report/`) | Node |
| `e2e` | the real app in a real browser: sign up, log in and out, create and join a household, add chores and mark them done, password reset, light and dark mode | Chromium (Playwright), against a running app and database |

```
npm test             # server + web + scripts
npm run test:e2e     # end to end
```

**End-to-end tests:**
- **One-time setup:** run `npx playwright install chromium` to download the browser.
- **Locally:** the tests use your `npm run dev` if it's running, or start it themselves, against the `dev` database. Test accounts use emails ending `@e2e.test` and are deleted when the run finishes.
- **Against a deployment:** set `E2E_BASE_URL` to its URL:
  - Git Bash: `E2E_BASE_URL=https://<url> npm run test:e2e`
  - PowerShell: `$env:E2E_BASE_URL="https://<url>"; npm run test:e2e`

  Deployed sites limit sign-ins, so these runs pace themselves and take about a minute.

**In GitHub Actions:** every push, and every pull request into `main`, runs the typecheck and the
same tests as `npm test`. Pushes and merged pull requests are then published to the
[test dashboard](https://antshep-umich.github.io/si526-team/). Every preview deployment also runs the
end-to-end tests against itself.

**Acceptance criteria:** tests that prove a Jira story's acceptance criteria are tagged with its key
and named after the criterion (`"AC2: refuses a second household for the same user"`), and the
story's criteria are listed in `acceptance/<KEY>.json`. The dashboard shows which are met.
[acceptance/README.md](acceptance/README.md) explains how, and TECH_SPEC section 15 has the details.

**Writing tests:** put test files next to the code they test (`Button.tsx` → `Button.test.tsx`).
Find elements the way a person would, by role and visible text, such as
`getByRole("button", { name: "Log in" })`, not by class names.

## Conflicts to resolve

Places where the Jira stories (`JAALS Stories.txt`), the Figma file and the build disagree, with
what we decided and what's built. **For the team to review together:** when a row is settled,
update the story or Figma to match and delete the row.

**Build status** says what the app does today: **Built** (done, matches the decision), **Built
(placeholder)** (works, but needs a design), or **Not built**.

### Stories vs. design vs. build

| # | Story | Topic | Story says | Figma or build had | Decision | Build status | Follow-up |
|---|---|---|---|---|---|---|---|
| 1 | SCRUM-7 | Chore statuses | 3 statuses: To do, Overdue, Done | Figma adds **Late**: done, but after the due date (Late chip, "1 Late" on the progress card) | Keep Late (UX added it) | Built | Add Late to the story |
| 2 | SCRUM-8 | Other people's chores | Only the assignee gets a checkbox; others see none | Every Figma card has a checkbox; there's no card without one | Follow the story | Built (placeholder): an empty space where the checkbox would be | UX: design the card without a checkbox |
| 3 | SCRUM-6, SCRUM-7 | The current user's name | "Me" | Figma: "You · due today" | **"You"** everywhere, including the Assigned to list: addressing the assignee directly does more to make them feel responsible | Built | Change "Me" to "You" in the stories |
| 4 | SCRUM-7 | To do label | Every status has a text label | Figma: to-do chores have no chip | No chip means "to do"; chips are for emphasis | Built | Update the story |
| 5 | SCRUM-7, SCRUM-8 | Done chores' dates | Done chores show the date they were completed, next to the due date | Figma's done cards show only the due date ("Sam · due Mon, Oct 5") | Show both | Built: "You · done today · due Mon, Oct 5" | Update the Figma done cards |
| 6 | SCRUM-7 | Time span | All the household's chores; Done section shows them all | Figma's progress card ("5 of 8 chores done") has no time span | **Weekly**, Monday to Sunday | Built: the progress card counts chores due this week; the Done section lists chores done this week; the to-do list shows every open chore | Update the stories |
| 7 | SCRUM-6 | Save button | "Save" | Figma: "Add chore" | "Add chore" | Built | Update the story |
| 8 | SCRUM-7 | Tapping a chore | The row expands to show notes, who created it and when | No design for an expanded row | Wait for a design | Not built (the API already returns notes, creator and created date) | UX: design the expanded row |
| 9 | SCRUM-32, SCRUM-74 | Pop-up messages | "You joined [Household name]." (SCRUM-32 AC3) · "Invite link copied." (SCRUM-74 AC5). "Chore added." and "Marked done. Undo" were dropped from SCRUM-6 and SCRUM-8 | No design for these messages | A placeholder toast (`src/components/Toast.tsx`): reverse colors, 16px above the tab bar, 4 seconds, announced to screen readers; only the two messages the stories ask for (Anthony, 2026-11-15) | Built (placeholder) | UX: design the message |
| 10 | SCRUM-3 | Logging in | Log in with **Name** and password; "Name is required.", "Name or password is incorrect." | The build logs in with email | Keep email | Built, with the story's messages reworded for email: "Email is required.", "Password is required.", "Email or password is incorrect.", "Something went wrong. Please try again." | Change the story to email |
| 11 | SCRUM-2 | Sign-up rules | Name 30 characters or fewer; password 8+ characters with a number; all errors at once; Name and Email kept and both passwords cleared; the story's exact messages; server errors in a banner above the form | The build checked only password length, one error at a time, in its own words | Make the build follow the story | Built. The server checks the same rules (Better Auth sign-up hook), and Forgot password uses the same password rule | None |
| 12 | SCRUM-32 | Join messages | "Enter an invite code." · "We couldn't find a household with that code. Check with your housemate and try again." · "Something went wrong. Please try again." | The build had its own wording | Make the build follow the story | Built (the "You joined…" message is row 9) | None |
| 13 | SCRUM-7 | Progress card when chores are overdue | Not covered | Figma has On track, Complete!, Late and Empty, but no state for falling behind | None yet | Built (placeholder): says "On track" even with overdue chores | UX: is there a "behind" state? |
| 14 | SCRUM-7 | Progress card under Mine | Not covered | Not designed | None yet | Built (placeholder): always counts the whole household | Team: should Mine show only your chores? |
| 15 | SCRUM-7 | Empty, loading and error states | "No chores yet. Add the first one." with an Add chore button · "Nothing assigned to you right now." · a loading indicator · "Couldn't load chores." with Try again | Not designed | Use the story's words | Built (placeholder): plain centered text. The empty state uses the Add chore button that's always at the top instead of a second one | UX: design these states |
| 16 | SCRUM-8 | Saving fails | "Couldn't update this chore. Please try again." and the checkbox goes back | No design for where the message goes | Use the story's words | Built (placeholder): red text above the list | UX: design it (could be the same as row 9) |
| 17 | SCRUM-6 | Only one member | Hint under Assigned to: "Invite housemates with code [code] to assign chores to them." | Not in Figma | Use the story's words | Built (placeholder): muted text under the field | UX: check the hint's style |
| 18 | SCRUM-7 | Date words | "Today," "Tomorrow" | Figma: lowercase mid-line ("You · due today") | Follow Figma | Built | None |
| 19 | SCRUM-44 | My chore history screen | A list of the user's chores with filters and sorting | Not in Figma | Build from existing components: household name, "My chore history"; All / Done / Not done filter; "Sort by" due date (newest or oldest first), date created or date completed; chores grouped by the month of the date they're sorted by, each row reading "Due Oct 29 · Done Oct 28" over "Created Oct 20" | Built (placeholder) | UX: design the screen |
| 20 | SCRUM-44 | Getting to the history | "User navigates to their personal chore history" | No entry point in Figma | A "My chore history" item in the Home menu, under Log out | Built (placeholder) | UX: where should it live (menu, House tab, profile)? |
| 21 | SCRUM-44, SCRUM-53 | Selecting a chore in the history | SCRUM-44: "displays additional details"; SCRUM-53 has its own Chore details screen (Figma "Home - Chore Details") | Not built yet | Until SCRUM-53 is built, the card expands in place: status, assigned to, created (date and by whom), due, completed (date and by whom), notes ("No description added." when empty) | Built (placeholder) | Open the SCRUM-53 screen instead once it exists |
| 22 | SCRUM-44 | "Chore no longer available." | Shown when a chore was deleted | Chores can't be deleted yet | Show it when the opened chore comes back `CHORE_NOT_FOUND` | Built | None |
| 23 | Single chore history story | Several completions of one chore | "Displays completion records in chronological order, with the most recent record shown first" | A chore has one due date and one completion; there are no recurring chores | None yet | Not built | Team: recurring chores (TECH_SPEC §11) decide whether this story has more than one record |
| 19 | SCRUM-6 | Picking a due date | "Date picker, today or later" | Figma has the field (calendar icon) but no calendar | Use the phone's own date picker | Built: dates before today can't be picked | None |
| 20 | — | Schedule tab | No story yet | Figma's tab bar has it, with no screen behind it | Show it as designed | Built (placeholder): visible but does nothing. House has its screen (SCRUM-74, rows 35–36) | A story and screen for Schedule |
| 24 | SCRUM-47 | Monthly household history screen | "Selects the monthly view" of the household chore history | Not in Figma (the "Chore History" frame is the personal history) | A Weekly / Monthly switch (Tab Filter) at the top of Household chore history; the monthly view reuses the weekly view's layout: a month bar with arrows ("Go to current month" when away from it), three summary numbers, then the chores, latest due first ("Due Fri, Nov 6 · Done Sun, Nov 8" over "Sam") | Built (placeholder) | UX: design both views and the switch |
| 25 | SCRUM-46, SCRUM-47 | Which week or month a chore belongs to | "Chores from the selected month" | The weekly view shows a chore in the week it's due **and** the week it was done | Monthly: the month it's due only, as the Home progress card counts weeks, so a chore never shows in two months | Built | Team: pick one rule for both views |
| 26 | SCRUM-46, SCRUM-47 | Summary numbers | "The number of completed, incomplete, and overdue chores" | Not designed | Overdue chores are also counted as incomplete, in both views | Built | Team: should the three numbers add up to the total instead? |
| 27 | SCRUM-47, SCRUM-53 | Selecting a chore in the monthly history | "Opens the selected chore's details and description" | The SCRUM-53 Chore details screen (Figma "Home - Chore Details") isn't built | Tapping a chore opens the single chore history screen (SCRUM-45), which shows the chore's details and notes, as the weekly view does | Built (placeholder) | Open the SCRUM-53 screen instead once it exists |
| 28 | SCRUM-7, SCRUM-53 | Where chore details show | SCRUM-53: selecting a chore "displays the chore details"; SCRUM-7 AC11: the arrow on the card slides a details pane open under it | Figma "Schedule" (837:1483) and the Jira attachment drop the details down under the card (Assigned To, Chore Details, a pencil); Figma "Home - Chore Details" (634:192) is a screen of its own | The dropdown: the chevron right of the chip (or the chore's name) rolls the details down under the card, and again rolls them up, which is SCRUM-53's Back. The Chore details screen built on 2026-11-18 is retired (Anthony, 2026-11-19) | Built | UX: retire "Home - Chore Details" in Figma; team: update SCRUM-53 AC3 in Jira |
| 29 | SCRUM-7, SCRUM-53 | What the dropdown shows | Name, assigned housemate, due date, completion status, description (SCRUM-53); "Last done" and "by" (SCRUM-7 AC11) | Figma's dropdown has Assigned To and Chore Details only | Assigned To, Due date, Status (To do, Overdue, Done or Done late), Last done ("Wed, Oct 28 by Sam", once done), Chore Details (or "No description added."), then a "View history" link moved down from the card's row | Built (placeholder) | UX: design the extra rows and the link |
| 30 | SCRUM-7, SCRUM-62 | Editing a chore | SCRUM-7 AC11: "an 'Edit' button visible to users with edit permissions"; SCRUM-62 gives those permissions to the household manager | Figma has a pencil at the top right of the dropdown, and "Home - Edit chore" (635:616) | The pencil opens Edit chore (the Add chore form, filled in; PATCH /api/chores/:id). Until SCRUM-62 builds household managers, the household owner and whoever added the chore may edit it, checked by the API too (Anthony, 2026-11-19; TECH_SPEC section 11). A changed due date shows in the chore's history | Built | Switch to the household manager with SCRUM-62 |
| 31 | SCRUM-7, SCRUM-53 | Tapping a card | "Selects a specific chore from the chore list" | Figma has the chevron; the card's tappable area was asked about in "UX Please Read" | The chevron and the chore's name and details both open the dropdown; the checkbox keeps its own job | Built (placeholder) | UX: confirm the tap area and a pressed state |
| 32 | SCRUM-53 | Opening from the history screens | "From the chore list or chore history" | Not designed for the history screens | My chore history still expands the chore in place (with the same details and messages); the household history still opens single chore history. Rows 21 and 27 stay open | Not built yet | Decide whether the histories use the dropdown too |
| 33 | SCRUM-7, SCRUM-44–47 | Getting around inside a household | "Opens the Chores tab" | Figma shows the tab bar on the chore list, and a Back link on "Home - Chore Details" | The tab bar stays at the bottom of every screen in a household, with only the screen above it scrolling (so Firefox for Android's toolbar can't slide over it, 2026-11-19) (chore list, Add chore, Edit chore, all three histories), and the header menu (Log out, My chore history, Household chore history) sits beside each of their titles; none of them has a Back link, and Chores always returns to the chore list (Anthony, 2026-11-12). Log in and household setup keep their Back links (SCRUM-32 AC4) and have no tab bar or menu | Built | UX: update Figma; decide whether a chore opened from Household chore history needs a way back to that week or month |
| 34 | SCRUM-3, SCRUM-44, SCRUM-46 | The header menu | "Log out" in the header menu | Figma "Home - Menu open" shows Log out alone, as a primary button (kept as a button on 2026-10-17) | A dropdown list on every household screen: My chore history, Household chore history, a divider, then Log out in the primary color; arrow keys move between items (Anthony, 2026-11-12) | Built | UX: design the list in Figma |
| 35 | SCRUM-74 | House tab: manager card and housemate profiles | AC3: the manager card, or “No Household Manager assigned” with a “Become household manager” button; AC2: selecting a housemate opens their profile | Not in Figma; SCRUM-62 (manager election) and SCRUM-72/63 (profiles) aren't built | Until they are, the card only says “No Household Manager assigned” (no button), nobody gets the “Household manager” chip, and a housemate opens a stand-in profile (Anthony, 2026-11-15) | Built (placeholder) | Replace the placeholders when SCRUM-62, 72 and 63 are built |
| 36 | SCRUM-74 | Inviting housemates | AC4: the invite code and link with “Copy” and “Share” buttons; AC5: Copy shows “Invite link copied.”; AC8: “Couldn't create an invite link. Please try again.” | Not in Figma | The invite code with one share icon at its top right, which opens the phone's share sheet with a `/join/CODE` link; no Copy button. Where there's no share sheet, the icon copies the link and shows “Invite link copied.” The link comes from the code, so AC8 can't happen (Anthony, 2026-11-15) | Built (placeholder) | Team: update SCRUM-74's AC4, AC5 and AC8 in Jira |
| 37 | SCRUM-72 | Who sets household manager preferences | "Users can save changes to their profile and preferences" | Not designed | Only the owner can change the assigned method; other members see it with "Only the household owner can change this." (team decision, 2026-11-19). The House tab's "Household Manager" (SCRUM-62) may replace the owner here | Built | Team: owner, or the Household Manager once SCRUM-62 exists? |
| 38 | SCRUM-72 | Edit profile state | "The user edits their name and clicks Save" | Only the view state is in Figma | Edit Profile turns Name into a text field with Save and Cancel; email is shown but can't change (no story for it, and Better Auth would need email verification) | Built (placeholder) | UX: design the edit state |
| 39 | SCRUM-72 | Selected chore choices and method | Select chore preferences and a method | Figma shows every choice as an outline button, none selected | A selected choice is filled like the primary button | Built (placeholder) | UX: design selected (and disabled, for non-owners) |
| 40 | SCRUM-72 | Weekly workload | Not in the story | Figma labels the picker "Weekly workload" and "Assigned to", and shows only "Medium (3-4 chores)" | Labelled "Weekly workload"; options Light (1-2 chores), Medium (3-4 chores), Heavy (5+ chores) | Built (placeholder) | UX: confirm the options; PM: add workload to the story |
| 41 | SCRUM-72 | Confirmation messages | Preferences: "displays a confirmation message" (no words given); name: "Profile updated successfully." | Not designed | Toasts: "Profile updated successfully.", "Chore preferences saved.", "Household preferences saved." | Built (placeholder) | PM: confirm the wording |
| 42 | SCRUM-72 | Getting to the profile | "The user opens their profile page" | The frame has the menu icon but no way in | "My profile" in the header menu, under the histories. The House tab's housemate profile (SCRUM-74 AC2) is still its placeholder | Built (placeholder) | UX: a Profile tab or menu item? |
| 43 | SCRUM-72 | What the preferences do | "Personalize how chores are assigned" | — | Saved only; nothing assigns chores from them yet | Built | Stories for automatic assignment |
| 49 | SCRUM-72 | Appearance (light or dark mode) | No story | Not in Figma; the app followed the phone's setting only | An "Appearance" section at the end of the profile: System, Light or Dark (the All / Mine switch), applied at once and kept on this device (Anthony, 2026-11-19). Numbered 49 to stay clear of the rows open pull requests add (44–48) | Built (placeholder) | UX: design the section |
| 50 | All | Picker lists | Every "Assigned to", "Sort by" and workload picker | Figma's open Picker field (Variant2) shows the list under the field, but not whether it pushes the page down | The list opens over the page, layered above what follows, at the field's width, and opens upward when there isn't room below (Anthony, 2026-11-19) | Built (placeholder) | UX: confirm, and design the upward version |
| 44 | SCRUM-45 | Another household's chore | AC4: “You are not apart of this household.” | Not designed | The API answers another household's chore exactly as it answers a deleted one (404 CHORE_NOT_FOUND), so it never confirms the chore exists; the screen shows “Chore no longer available.” (Anthony, 2026-11-19) | Built | Team: update SCRUM-45 AC4 in Jira |
| 45 | All | Animation | No story | Not in Figma | Everything that drops down or rolls up animates: chore dropdowns, the Done list, the header menu, the Assigned to list and My chore history's rows (a 220ms roll, or a 180ms fade for the menu); chevrons turn. Off with the phone's reduce-motion setting (Anthony, 2026-11-19) | Built (placeholder) | UX: confirm the timing |
| 46 | SCRUM-61, SCRUM-72 | What a "preferred chore" is | SCRUM-61: "Displays the household's chores, each with an option to mark it as preferred" | Figma has SCRUM-72's chore types only | The chore types in Set chore preferences (SCRUM-72) are the preferences. Add chore has an optional Category with the same types; housemates who chose a chore's category show "· Prefers this chore" in Assigned to (team decision, 2026-11-19). SCRUM-61 AC4 ("No chores to choose from yet.") can't happen | Built | PM: update SCRUM-61 in Jira |
| 47 | SCRUM-61 | Category in Add and Edit chore | Not in the story | The Add and Edit chore frames have no Category | "Category (optional)" between Chore name and Assigned to, with "No category" to clear it. Chores added before have none. Not shown anywhere else yet | Built (placeholder) | UX: design it; show it on Chore details? |
| 48 | SCRUM-61 | "Prefers this chore" | AC3: "shown as preferring it in the assignment options" | Not designed | Part of the option's label: "Ben Ito · Prefers this chore" | Built (placeholder) | UX: design it; in Add and Edit chore |

### Design issues in Figma

| # | Where in Figma | Issue | Decision | Build status |
|---|---|---|---|---|
| D1 | Progress card, `Property 1=Late` (455:1748) | The "1 Late" text is overdue/fill (#F5C451) on white: about **1.6:1** contrast. Text this size needs 4.5:1 (WCAG AA). overdue/line (#8A5A00) would be about 5.9:1 | Build it as designed for now | Built as designed |
| D2 | Several components (see the next table) | Placeholder variant names ("Status4", "Variant2") | Rename in Figma | Built with the meanings below |
| D3 | Button description (148:503) | Says the focus ring has a **3px** gap; the Focus variants draw **2px** | Follow the variants | Built: 2px |
| D4 | Tab Filter, Done section, Picker field, Text area, the new Progress card states, the Late chip, and the menu, chevron, calendar and eye icons | No dark-mode version | Derive dark mode from the dark color tokens; recolor the icons to the dark token values | Built (derived) |
| D5 | `action/primary-disabled` color | No dark-mode value | Dark primary (#E0876A) at 50%, like light mode | Built (derived) |
| D6 | Button, Type=Outline | No Disabled state | None yet | Built (placeholder): faded to 50% |
| D7 | Home - Add Chore (refined) (462:393) | The Chore name field is fixed at 320px; the other fields fill the width (354px) | Build it full width like the others | Built: full width |
| D8 | `icon/chevron/up` | Exports as a down chevron (it's turned 180° on the canvas) | Turn it in code | Built |
| D9 | Picker field, open (454:2773) | No style for the chosen option or the keyboard highlight | None yet | Built (placeholder): chosen option bold; keyboard highlight uses the focus ring |

**Placeholder names in Figma** and what they are:

| Component | Placeholder name | What it is | Suggested name | In code |
|---|---|---|---|---|
| Chore card (148:538) | `Status=Status4` (454:2714) | Done after the due date: struck-through name, Late chip | `Status=Late` | `ChoreCard status="late"` |
| Done section (collapsed) (426:344) | `Property 1=Variant2` (426:345) | The section opened (chevron up) | `State=Open` (and rename the set "Done section") | `DoneSection expanded` |
| Picker field (454:2772) | `Property 1=Variant2` (454:2773) | The field opened, listing the options | `State=Open` | `PickerField`, while its list is open |

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm run dev` stops right away with ".env: not found" | Create `.env` (see [Getting started](#getting-started)) |
| `git push` fails with a 403 error | Git is using a different GitHub account. Run `gh auth switch`, then `gh auth setup-git` |
| "Too many tries" when signing in on a preview | Deployed sites allow 3 sign-ins, then need 10 quiet seconds. Wait and try again |
| `npm run test:e2e` can't find a browser | Run `npx playwright install chromium` |
| Port 5173 or 3000 already in use | A previous `npm run dev` is still running. Stop it, or close that terminal |
| Database errors after pulling someone's changes | Run `npx prisma migrate deploy` to apply their migrations, then `npx prisma generate` |
