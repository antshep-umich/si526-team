import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAIN_REPORTS_KEPT, branchSlug, parseSite } from "./site.ts";
import { updateSiteDir } from "./site-files.ts";
import type { RunMeta, RunSummary } from "./types.ts";

const NOW = "2026-10-28T18:00:00.000Z";
const at = (minute: number) => new Date(Date.UTC(2026, 9, 28, 10, minute)).toISOString();

function run(meta: Partial<RunMeta>, startedAt: string): RunSummary {
  return {
    meta: { kind: "main", runId: "1-1", runUrl: null, repoUrl: null, branch: "main", sha: "abc", message: "", pr: null, ...meta },
    startedAt,
    durationMs: 400,
    outcome: "passed",
    totals: { total: 1, passed: 1, failed: 0, skipped: 0 },
    stories: [],
    problems: [],
  };
}

/** Every file under `dir` with its contents, for before/after comparisons. */
function snapshot(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const path = join(d, e.name);
      if (e.isDirectory()) walk(path);
      else files[relative(dir, path)] = readFileSync(path, "utf8");
    }
  };
  walk(dir);
  return files;
}

let root: string;
let site: string;
let fontsDir: string;
let reportHtml: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "site-files-"));
  site = join(root, "site");
  fontsDir = join(root, "fonts");
  mkdirSync(site);
  mkdirSync(fontsDir);
  writeFileSync(join(fontsDir, "Libron-Regular.woff2"), "font");
  writeFileSync(join(fontsDir, "OFL.txt"), "licence");
  writeFileSync(join(fontsDir, "README.md"), "not copied");
  reportHtml = join(root, "report.html");
  writeFileSync(reportHtml, "<html>report</html>");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const update = (summary: RunSummary, liveBranches: string[] | null = null) =>
  updateSiteDir(site, { summary, reportHtml, liveBranches, fontsDir, now: NOW });

describe("updateSiteDir", () => {
  it("builds a whole site in an empty directory", () => {
    expect(update(run({ runId: "5-1" }, at(1)))).toEqual({ accepted: true });

    const history = parseSite(readFileSync(join(site, "data/history.json"), "utf8"));
    expect(history.main).toHaveLength(1);
    expect(readFileSync(join(site, "reports/main/5-1/index.html"), "utf8")).toBe("<html>report</html>");
    expect(readFileSync(join(site, "index.html"), "utf8")).toContain("<!doctype html>");
    expect(existsSync(join(site, ".nojekyll"))).toBe(true);
    expect(readdirSync(join(site, "assets/fonts")).sort()).toEqual(["Libron-Regular.woff2", "OFL.txt"]);
  });

  it("replaces a branch's previous report with its new one", () => {
    update(run({ kind: "branch", branch: "louise-dev", runId: "1-1" }, at(1)));
    update(run({ kind: "branch", branch: "louise-dev", runId: "2-1" }, at(2)));

    const branchDir = join(site, "reports/branches", branchSlug("louise-dev"));
    expect(readdirSync(branchDir)).toEqual(["2-1"]);
  });

  it("deletes the report of a branch that no longer exists", () => {
    update(run({ kind: "branch", branch: "louise-dev", runId: "1-1" }, at(1)));
    update(run({ runId: "2-1" }, at(2)), ["main"]);

    expect(existsSync(join(site, "reports/branches", branchSlug("louise-dev")))).toBe(false);
    expect(existsSync(join(site, "reports/main/2-1/index.html"))).toBe(true);
  });

  it(`deletes main reports beyond the newest ${MAIN_REPORTS_KEPT}`, () => {
    for (let i = 0; i <= MAIN_REPORTS_KEPT; i++) update(run({ runId: `${i}-1` }, at(i)));

    expect(existsSync(join(site, "reports/main/0-1"))).toBe(false);
    expect(readdirSync(join(site, "reports/main"))).toHaveLength(MAIN_REPORTS_KEPT);
  });

  it("changes nothing when an older run arrives after a newer one for the same branch", () => {
    update(run({ kind: "branch", branch: "louise-dev", runId: "2-1" }, at(2)));
    const before = snapshot(site);

    expect(update(run({ kind: "branch", branch: "louise-dev", runId: "1-1" }, at(1)))).toEqual({ accepted: false });
    expect(snapshot(site)).toEqual(before);
  });

  it("refuses to touch a site whose history can't be read", () => {
    mkdirSync(join(site, "data"));
    writeFileSync(join(site, "data/history.json"), "{ broken");
    const before = snapshot(site);

    expect(() => update(run({ runId: "5-1" }, at(1)))).toThrow();
    expect(snapshot(site)).toEqual(before);
  });
});
