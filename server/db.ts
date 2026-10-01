import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

let client: PrismaClient | undefined;

/**
 * The one shared Prisma client. Created on first use so a missing DATABASE_URL
 * becomes a request error instead of crashing the Function at load.
 * DATABASE_URL is Neon's pooled connection (TECH_SPEC section 7).
 */
export function getPrisma(): PrismaClient {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    client = new PrismaClient({
      adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 10_000 }),
    });
  }
  return client;
}
