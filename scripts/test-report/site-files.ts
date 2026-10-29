import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderSite } from "./render.ts";
import { applyRun, emptySite, parseSite, pruneBranches, referencedReports } from "./site.ts";
import type { RunSummary } from "./types.ts";

export interface SiteInputs {
  summary: RunSummary;
  /** The run's single-file Vitest HTML report. */
  reportHtml: string;
  /** Branches that exist on GitHub, or null if unknown (then no branch is dropped). */
  liveBranches: string[] | null;
  /** Folder with the Libron .woff2 files and OFL.txt. */
  fontsDir: string;
  now: string;
}

/** Deletes report folders no row links to any more, then any folders left empty. */
function removeUnusedReports(siteDir: string, keep: Set<string>): void {
  const walk = (rel: string): void => {
    const abs = join(siteDir, rel);
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const child = `${rel}/${entry.name}`;
      if (existsSync(join(siteDir, child, "index.html"))) {
        if (!keep.has(child)) rmSync(join(siteDir, child), { recursive: true, force: true });
      } else {
        walk(child);
        if (readdirSync(join(siteDir, child)).length === 0) rmSync(join(siteDir, child), { recursive: true });
      }
    }
  };
  if (existsSync(join(siteDir, "reports"))) walk("reports");
}

/**
 * Adds one run to a dashboard site on disk: history, report, page, fonts.
 * Reads and checks the history before writing anything, so a bad history
 * leaves the directory untouched. Returns accepted: false when the run
 * changes nothing (an older run for a branch that has a newer one).
 */
export function updateSiteDir(siteDir: string, inputs: SiteInputs): { accepted: boolean } {
  const historyFile = join(siteDir, "data", "history.json");
  const current = existsSync(historyFile) ? parseSite(readFileSync(historyFile, "utf8")) : emptySite(inputs.now);
  const applied = applyRun(current, inputs.summary, inputs.now);
  if (applied.site === current) return { accepted: false };
  if (applied.reportDir && !existsSync(inputs.reportHtml)) {
    throw new Error(`No HTML report at ${inputs.reportHtml}`);
  }

  const site = pruneBranches(applied.site, inputs.liveBranches);
  if (applied.reportDir) {
    mkdirSync(join(siteDir, applied.reportDir), { recursive: true });
    copyFileSync(inputs.reportHtml, join(siteDir, applied.reportDir, "index.html"));
  }

  mkdirSync(join(siteDir, "data"), { recursive: true });
  writeFileSync(historyFile, `${JSON.stringify(site, null, 2)}\n`);
  writeFileSync(join(siteDir, "index.html"), renderSite(site));
  // Without this file GitHub Pages runs Jekyll, which skips some files.
  writeFileSync(join(siteDir, ".nojekyll"), "");

  const fontsOut = join(siteDir, "assets", "fonts");
  mkdirSync(fontsOut, { recursive: true });
  for (const file of readdirSync(inputs.fontsDir)) {
    if (file.endsWith(".woff2") || file === "OFL.txt") copyFileSync(join(inputs.fontsDir, file), join(fontsOut, file));
  }

  removeUnusedReports(siteDir, referencedReports(site));
  return { accepted: true };
}
