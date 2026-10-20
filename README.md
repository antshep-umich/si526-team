# si526-team
Team project repo for SI526
#test

**test comment from louise :)**

Shared chore tracker for Team JAALS (SI 526). See [TECH_SPEC.md](TECH_SPEC.md) for the design, decisions and setup status.

## Quick start

Needs Node.js 24 and a `.env` file (copy `.env.example`, then fill in the Neon `dev` branch connection strings and a random `BETTER_AUTH_SECRET`; see TECH_SPEC section 14).

To use the app locally, create an account on the sign-in screen. Accounts live in the shared `dev` database, so any made-up email works.

    npm install      # also generates the Prisma client
    npm run dev      # React on http://localhost:5173, API on http://localhost:3000
    npm test         # unit tests (see Tests below)

## Design system

Colors, fonts and text styles from the Figma "App Design" file live in `src/styles/tokens.css`. Light or dark mode follows the device's system setting. The Figma components are React components in `src/components/`.

To see every component, run `npm run dev` and open http://localhost:5173/components.html. On a deployment, it's at `/components`. It follows the device's light or dark setting unless you pick Light or Dark with its switch, and "Show sizes" prints each component's size so you can compare it with Figma.

## Tests

All tests use [Vitest](https://vitest.dev). `vitest.config.ts` splits them into three projects:

| Project | Where | What it covers | Runs in |
|---|---|---|---|
| `server` | `server/**/*.test.ts`, `shared/**/*.test.ts` | routes and controllers (through Express with Supertest), services, models, middleware, shared validation, and the layer rules (`server/architecture.test.ts`) | Node, with in-memory models (`server/test/fakeModels.ts`) instead of a database |
| `web` | `src/**/*.test.{ts,tsx}` | components, screens, App's screen routing, API helpers | jsdom, with React Testing Library |
| `e2e` | `e2e/*.e2e.test.ts` | the real app in a real browser: sign up, log in/out, create and join a household, password reset, light/dark mode, the components page | Chromium via Playwright, against a running app and database |

    npm test                 # server + web: fast, no database needed
    npm run test:watch       # the same, re-running as you edit
    npm run test:e2e         # end to end, against your local app

**End-to-end setup:** run `npx playwright install chromium` once to download the browser. `npm run test:e2e` uses your `npm run dev` if it's running, or starts it, and uses the `dev` database from `.env`. Test accounts use emails ending `@e2e.test`. When the run finishes, it deletes them and any households only they belonged to.

**Against a deployment:** `E2E_BASE_URL=https://<preview-url> npm run test:e2e`. Deployed sites limit sign-ins and sign-ups (3, then 10 seconds of quiet), so the tests pace themselves there and take about a minute.

**In GitHub Actions:**
- `Tests` (`.github/workflows/tests.yml`): typecheck and `npm test` on every push and pull request.
- `E2E on preview` (`.github/workflows/e2e-preview.yml`): the end-to-end tests against each Vercel preview once it's deployed. Previews have their own throwaway database, so test accounts never reach dev or production.

**Conventions:** test files sit next to the code they test (`Button.tsx` → `Button.test.tsx`). Find elements the way people do: by role and visible label (`getByRole("button", { name: "Log in" })`), not by class names or test ids.

## Database changes

Edit `prisma/schema.prisma`, then run `npx prisma migrate dev --name <what-changed>` and commit the new folder in `prisma/migrations/`. Vercel applies migrations automatically when it builds.
