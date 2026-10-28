// Turns test-report/results.json into test-report/summary.json, the record the
// dashboard keeps for one run. Exits 1 if an AC file or a test's tags are wrong.
// Usage: node scripts/test-report/summarize.ts (after `vitest run --mode report`)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadStories } from "./acceptance.ts";
import { buildRunSummary, runMetaFromEnv } from "./summary.ts";
import type { TestResults } from "./types.ts";

const RESULTS_FILE = "test-report/results.json";
const SUMMARY_FILE = "test-report/summary.json";

function git(...args: string[]): string | undefined {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
}

if (!existsSync(RESULTS_FILE)) {
  console.error(`No test results at ${RESULTS_FILE}. Run \`npx vitest run --mode report\` first.`);
  process.exit(1);
}

const env = { ...process.env };
if (env.GITHUB_ACTIONS !== "true") {
  env.LOCAL_BRANCH ??= git("rev-parse", "--abbrev-ref", "HEAD");
  env.LOCAL_SHA ??= git("rev-parse", "HEAD");
  env.COMMIT_MESSAGE ??= git("log", "-1", "--format=%s");
}

const results = JSON.parse(readFileSync(RESULTS_FILE, "utf8")) as TestResults;
const { stories, problems } = loadStories("acceptance");
const summary = buildRunSummary(results, stories, problems, runMetaFromEnv(env, new Date().toISOString()));
writeFileSync(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`);

const { passed, failed, skipped } = summary.totals;
console.log(`Tests ${summary.outcome}: ${passed} passed, ${failed} failed, ${skipped} skipped.`);
for (const story of summary.stories) {
  const met = story.criteria.filter((c) => c.status === "passing" || c.status === "manual").length;
  console.log(`${story.story} ${story.title}: ${met} of ${story.criteria.length} ACs met`);
  for (const c of story.criteria) console.log(`  ${c.id} ${c.status}`);
}
if (summary.problems.length > 0) {
  console.error(`\n${summary.problems.length} problem(s) with AC files or test tags:`);
  for (const p of summary.problems) console.error(`  - ${p}`);
  process.exitCode = 1;
}
