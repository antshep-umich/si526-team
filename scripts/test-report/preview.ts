// Builds a local copy of the dashboard in test-report/site from the last
// `npm run test:report`, so the page can be checked without publishing.
// Each run is added to the same local history, as a main run by default.
// Usage: node scripts/test-report/preview.ts [--as branch]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { updateSiteDir } from "./site-files.ts";
import type { RunSummary } from "./types.ts";

const asBranch = process.argv.includes("--as") && process.argv[process.argv.indexOf("--as") + 1] === "branch";
const summary = JSON.parse(readFileSync("test-report/summary.json", "utf8")) as RunSummary;
summary.meta = { ...summary.meta, kind: asBranch ? "branch" : "main" };

updateSiteDir("test-report/site", {
  summary,
  reportHtml: "test-report/html/index.html",
  liveBranches: null,
  fontsDir: "src/assets/fonts/libron",
  now: new Date().toISOString(),
});
console.log(`Dashboard preview: ${resolve("test-report/site/index.html")}`);
