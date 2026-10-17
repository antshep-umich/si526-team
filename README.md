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
    npm test         # unit tests

## Design system

Colors, fonts and text styles from the Figma "App Design" file live in `src/styles/tokens.css`. Light or dark mode follows the device's system setting. The Figma components are React components in `src/components/`.

To see every component, run `npm run dev` and open http://localhost:5173/components.html. On a deployment, it's at `/components`. It follows the device's light or dark setting unless you pick Light or Dark with its switch, and "Show sizes" prints each component's size so you can compare it with Figma.

## Database changes

Edit `prisma/schema.prisma`, then run `npx prisma migrate dev --name <what-changed>` and commit the new folder in `prisma/migrations/`. Vercel applies migrations automatically when it builds.
