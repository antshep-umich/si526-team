import { checkHouseholdTable } from "../models/households.js";

/** Throws if the database is unreachable, isn't configured, or migrations haven't run. */
export function checkDatabase(): Promise<void> {
  return checkHouseholdTable();
}
