import { getPrisma } from "../db.js";

/**
 * Reads the Household table, so it throws if the database is unreachable, isn't
 * configured, or migrations haven't run.
 */
export async function checkDatabase(): Promise<void> {
  await getPrisma().household.findFirst({ select: { id: true } });
}
