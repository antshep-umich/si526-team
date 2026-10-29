import { describe, expect, it } from "vitest";
import {
  MAIN_REPORTS_KEPT,
  applyRun,
  branchSlug,
  emptySite,
  parseSite,
  pruneBranches,
  referencedReports,
} from "./site.ts";
import type { RunMeta, RunSummary, SiteData } from "./types.ts";

const NOW = "2026-10-28T18:00:00.000Z";

function run(meta: Partial<RunMeta>, startedAt: string, passed = 10): RunSummary {
  return {
    meta: {
      kind: "main",
      runId: "1-1",
      runUrl: null,
      repoUrl: null,
      branch: "main",
      sha: "abc",
      message: "",
      pr: null,
      ...meta,
    },
    startedAt,
    durationMs: 400,
    outcome: "passed",
    totals: { total: passed, passed, failed: 0, skipped: 0 },
    stories: [],
    problems: [],
  };
}

/** Runs one minute apart, starting at 10:00. */
const at = (minute: number) => new Date(Date.UTC(2026, 9, 28, 10, minute)).toISOString();

function applyAll(site: SiteData, runs: RunSummary[]): SiteData {
  return runs.reduce((s, r) => applyRun(s, r, NOW).site, site);
}

describe("applyRun on main", () => {
  it("puts the newest run first, whatever order runs arrive in", () => {
    const site = applyAll(emptySite(NOW), [run({ runId: "2-1" }, at(2)), run({ runId: "1-1" }, at(1))]);
    expect(site.main.map((e) => e.summary.meta.runId)).toEqual(["2-1", "1-1"]);
  });

  it("returns where to put the report", () => {
    const { reportDir, site } = applyRun(emptySite(NOW), run({ runId: "123-2" }, at(1)), NOW);
    expect(reportDir).toBe("reports/main/123-2");
    expect(site.main[0].report).toBe("reports/main/123-2");
    expect(site.updatedAt).toBe(NOW);
  });

  it("replaces a run published twice instead of adding a second row", () => {
    const site = applyAll(emptySite(NOW), [run({ runId: "5-1" }, at(1), 10), run({ runId: "5-1" }, at(1), 12)]);
    expect(site.main).toHaveLength(1);
    expect(site.main[0].summary.totals.passed).toBe(12);
  });

  it(`keeps every row but only the newest ${MAIN_REPORTS_KEPT} reports`, () => {
    const runs = Array.from({ length: MAIN_REPORTS_KEPT + 1 }, (_, i) => run({ runId: `${i}-1` }, at(i)));
    const site = applyAll(emptySite(NOW), runs);

    expect(site.main).toHaveLength(MAIN_REPORTS_KEPT + 1);
    expect(site.main[MAIN_REPORTS_KEPT - 1].report).toBe("reports/main/1-1");
    expect(site.main[MAIN_REPORTS_KEPT]).toMatchObject({ report: null, summary: { meta: { runId: "0-1" } } });
  });

  it("doesn't ask for a report when a late run is already too old to keep one", () => {
    const newer = Array.from({ length: MAIN_REPORTS_KEPT }, (_, i) => run({ runId: `${i + 10}-1` }, at(i + 10)));
    const { reportDir, site } = applyRun(applyAll(emptySite(NOW), newer), run({ runId: "1-1" }, at(1)), NOW);
    expect(reportDir).toBeNull();
    expect(site.main.at(-1)).toMatchObject({ report: null, summary: { meta: { runId: "1-1" } } });
  });

  it("doesn't change the site it was given", () => {
    const original = applyAll(emptySite(NOW), [run({ runId: "1-1" }, at(1))]);
    const copy = structuredClone(original);
    applyRun(original, run({ runId: "2-1" }, at(2)), "2026-10-29T00:00:00.000Z");
    expect(original).toEqual(copy);
  });
});

describe("applyRun on a branch", () => {
  const louise = (runId: string, minute: number) => run({ kind: "branch", branch: "louise-dev", runId }, at(minute));

  it("keeps one row per branch, holding its latest run", () => {
    const site = applyAll(emptySite(NOW), [louise("1-1", 1), louise("2-1", 2)]);
    expect(site.branches).toHaveLength(1);
    expect(site.branches[0].summary.meta.runId).toBe("2-1");
    expect(site.branches[0].report).toBe(`reports/branches/${branchSlug("louise-dev")}/2-1`);
  });

  it("ignores a run older than the one already recorded", () => {
    const site = applyAll(emptySite(NOW), [louise("2-1", 2)]);
    const result = applyRun(site, louise("1-1", 1), NOW);
    expect(result.reportDir).toBeNull();
    expect(result.site).toEqual(site);
  });

  it("lists the most recently active branch first", () => {
    const site = applyAll(emptySite(NOW), [
      louise("1-1", 1),
      run({ kind: "branch", branch: "shivani-dev", runId: "2-1" }, at(2)),
    ]);
    expect(site.branches.map((e) => e.summary.meta.branch)).toEqual(["shivani-dev", "louise-dev"]);
  });
});

describe("applyRun on a merged pull request", () => {
  const merged = (number: number, mergedAt: string) =>
    run(
      { kind: "merged", branch: "louise-dev", runId: `${number}-1`, pr: { number, title: `PR ${number}`, mergeSha: "m", mergedAt } },
      at(1),
    );

  it("keeps one row per PR, even when a branch name comes back", () => {
    const site = applyAll(emptySite(NOW), [merged(8, at(10)), merged(12, at(20))]);
    expect(site.merged.map((e) => e.summary.meta.pr?.number)).toEqual([12, 8]);
    expect(site.merged[0].report).toBe("reports/merged/pr-12");
  });

  it("replaces a PR's row if it's published again", () => {
    const site = applyAll(emptySite(NOW), [merged(8, at(10)), merged(8, at(10))]);
    expect(site.merged).toHaveLength(1);
  });
});

describe("applyRun on runs that aren't published", () => {
  it.each(["pull-request", "local"] as const)("refuses a %s run", (kind) => {
    expect(() => applyRun(emptySite(NOW), run({ kind }, at(1)), NOW)).toThrow(kind);
  });
});

describe("pruneBranches", () => {
  const site = applyAll(emptySite(NOW), [
    run({ kind: "branch", branch: "louise-dev", runId: "1-1" }, at(1)),
    run({ kind: "branch", branch: "shivani-dev", runId: "2-1" }, at(2)),
  ]);

  it("drops branches that no longer exist", () => {
    const pruned = pruneBranches(site, ["main", "shivani-dev"]);
    expect(pruned.branches.map((e) => e.summary.meta.branch)).toEqual(["shivani-dev"]);
  });

  it("keeps every branch when the live list is unknown", () => {
    expect(pruneBranches(site, null)).toEqual(site);
  });
});

describe("branchSlug", () => {
  it("only uses characters that are safe in a URL path", () => {
    expect(branchSlug("feature/a b?#%")).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it("keeps similar branch names apart", () => {
    expect(branchSlug("a/b")).not.toBe(branchSlug("a-b"));
  });

  it("can't climb out of the reports directory", () => {
    expect(branchSlug("..")).not.toContain("..");
  });
});

describe("parseSite", () => {
  it("reads a saved site", () => {
    const site = applyAll(emptySite(NOW), [run({ runId: "1-1" }, at(1))]);
    expect(parseSite(JSON.stringify(site))).toEqual(site);
  });

  it.each([
    ["invalid JSON", "{ nope"],
    ["no version", JSON.stringify({ main: [], branches: [], merged: [] })],
    ["a section that isn't a list", JSON.stringify({ version: 1, updatedAt: NOW, main: {}, branches: [], merged: [] })],
  ])("rejects %s", (_label, text) => {
    expect(() => parseSite(text)).toThrow();
  });
});

describe("referencedReports", () => {
  it("lists every report a row still points to", () => {
    const runs = Array.from({ length: MAIN_REPORTS_KEPT + 1 }, (_, i) => run({ runId: `${i}-1` }, at(i)));
    const site = applyAll(emptySite(NOW), [
      ...runs,
      run({ kind: "branch", branch: "louise-dev", runId: "99-1" }, at(59)),
    ]);
    const reports = referencedReports(site);

    expect(reports.size).toBe(MAIN_REPORTS_KEPT + 1);
    expect(reports.has("reports/main/0-1")).toBe(false);
    expect(reports.has(`reports/branches/${branchSlug("louise-dev")}/99-1`)).toBe(true);
  });
});
