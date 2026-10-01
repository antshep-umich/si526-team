// Prisma CLI config. Loads .env locally; on Vercel the Neon integration provides the variables.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Migrations need the direct (unpooled) connection. Read with process.env rather than
  // Prisma's env() helper so `prisma generate` still works where no database is configured.
  datasource: { url: process.env.DATABASE_URL_UNPOOLED },
});
