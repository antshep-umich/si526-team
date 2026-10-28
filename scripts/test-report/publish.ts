// Adds this run to the dashboard on the gh-pages branch. The Tests workflow's
// publish job runs it after summarize.ts: node scripts/test-report/publish.ts
// PUBLISH_REMOTE overrides the remote (default origin), e.g. to try it against
// a local bare repository.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { publishToBranch } from "./pages-git.ts";
import { updateSiteDir } from "./site-files.ts";
import type { RunSummary } from "./types.ts";

const summary = JSON.parse(readFileSync("test-report/summary.json", "utf8")) as RunSummary;
const { kind, runId, branch, sha, pr } = summary.meta;
if (kind !== "main" && kind !== "branch" && kind !== "merged") {
  console.error(`Not publishing a ${kind} run. Only pushes and merged pull requests go on the dashboard.`);
  process.exit(1);
}

const reportHtml = resolve("test-report/html/index.html");
const fontsDir = resolve("src/assets/fonts/libron");
const label = kind === "merged" ? `PR #${pr?.number} (${branch})` : branch;

const result = publishToBranch({
  repoDir: ".",
  remote: process.env.PUBLISH_REMOTE || "origin",
  branch: "gh-pages",
  message: `Publish ${kind} run ${runId}: ${label} at ${sha.slice(0, 7)}`,
  build: (siteDir, liveBranches) =>
    updateSiteDir(siteDir, { summary, reportHtml, liveBranches, fontsDir, now: new Date().toISOString() }).accepted,
});

if (!result.commit) {
  console.log("Nothing to publish: the dashboard already has a newer run for this branch.");
} else {
  console.log(`Published ${label} to gh-pages as ${result.commit.slice(0, 7)}.`);
  const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
  if (owner && repo) console.log(`Dashboard: https://${owner.toLowerCase()}.github.io/${repo}/`);
}
