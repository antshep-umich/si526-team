# si526-team
Team project repo for SI526
#test

Shared chore tracker for Team JAALS (SI 526). See [TECH_SPEC.md](TECH_SPEC.md) for the design, decisions and setup status.

## Quick start

Needs Node.js 24 and a `.env` file (copy `.env.example` and fill in the Neon `dev` branch connection strings; see TECH_SPEC section 14).

    npm install      # also generates the Prisma client
    npm run dev      # React on http://localhost:5173, API on http://localhost:3000
    npm test         # unit tests

## Database changes

Edit `prisma/schema.prisma`, then run `npx prisma migrate dev --name <what-changed>` and commit the new folder in `prisma/migrations/`. Vercel applies migrations automatically when it builds.
