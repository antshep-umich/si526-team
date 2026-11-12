// Seeds the test household (testHouse.ts). Every Vercel build runs this, but it only
// writes on preview builds. Locally: `npm run seed:test-house` (the dev database in .env).
import { getPrisma } from "../db.js";
import { seedTarget, seedTestHouse, TEST_HOUSE_NAME, TEST_PEOPLE } from "./testHouse.js";

const target = seedTarget(process.env, process.argv.slice(2));

if (!target) {
  console.log("Test household: skipped. Only preview builds and `npm run seed:test-house` add test data.");
} else {
  try {
    const { chores, inviteCode } = await seedTestHouse();
    console.log(
      `Test household: reset ${TEST_HOUSE_NAME} with ${chores} chores (invite code ${inviteCode}). ` +
        `Sign in as ${TEST_PEOPLE.you.email}.`,
    );
  } catch (error) {
    console.error("Test household: couldn't seed it.", error);
    // A preview without test data is still worth deploying; a local run should fail loudly.
    if (target === "local") process.exitCode = 1;
  } finally {
    await getPrisma().$disconnect();
  }
}
