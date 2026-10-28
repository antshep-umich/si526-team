import { describe, expect, it } from "vitest";
import { escapeHtml, renderSite } from "./render.ts";
import { MAIN_REPORTS_KEPT, applyRun, emptySite } from "./site.ts";
import type { RunMeta, RunSummary, SiteData, StoryCoverage } from "./types.ts";

const NOW = "2026-10-28T18:00:00.000Z";
const at = (minute: number) => new Date(Date.UTC(2026, 9, 28, 10, minute)).toISOString();

function run(meta: Partial<RunMeta>, startedAt: string, extra: Partial<RunSummary> = {}): RunSummary {
  return {
    meta: {
      kind: "main",
      runId: "1-1",
      runUrl: "https://github.com/o/r/actions/runs/1",
      repoUrl: "https://github.com/o/r",
      branch: "main",
      sha: "1111111aaaa",
      message: "Merge pull request #8",
      pr: null,
      ...meta,
    },
    startedAt,
    durationMs: 400,
    outcome: "passed",
    totals: { total: 10, passed: 10, failed: 0, skipped: 0 },
    stories: [],
    problems: [],
    ...extra,
  };
}

function build(runs: RunSummary[]): SiteData {
  return runs.reduce((s, r) => applyRun(s, r, NOW).site, emptySite(NOW));
}

/** The HTML of one section of the page, by its id. */
function section(html: string, id: string): string {
  const match = new RegExp(`<section id="${id}"[\\s\\S]*?</section>`).exec(html);
  if (!match) throw new Error(`no section #${id}`);
  return match[0];
}

const SECTIONS = ["latest", "chart", "coverage", "branches", "merged", "history"];

describe("escapeHtml", () => {
  it("escapes the characters that matter in text and attributes", () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;");
  });
});

describe("renderSite", () => {
  it("shows untrusted text as text everywhere it appears", () => {
    const evil = `<script>alert(1)</script> "quoted" & more`;
    const story: StoryCoverage = {
      story: "SCRUM-18",
      title: evil,
      criteria: [{ id: "AC1", text: evil, verify: "test", status: "passing", tests: [{ name: evil, state: "passed" }] }],
    };
    const site = build([
      run({ message: evil }, at(1), { stories: [story], problems: [evil] }),
      run({ kind: "branch", branch: `x"onmouseover="alert(1)`, runId: "2-1", message: evil }, at(2)),
      run(
        {
          kind: "merged",
          branch: evil,
          runId: "3-1",
          message: evil,
          pr: { number: 9, title: evil, mergeSha: null, mergedAt: at(3) },
        },
        at(3),
      ),
    ]);

    const html = renderSite(site);

    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain(`"onmouseover="`);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("gives every section an empty state when there's no history yet", () => {
    const html = renderSite(emptySite(NOW));
    for (const id of SECTIONS) expect(section(html, id)).toContain('class="empty"');
  });

  it("draws one bar per main run, oldest first", () => {
    const html = renderSite(build([run({ runId: "2-1" }, at(2)), run({ runId: "1-1" }, at(1))]));
    const bars = [...section(html, "chart").matchAll(/data-run="([^"]+)"/g)].map((m) => m[1]);
    expect(bars).toEqual(["1-1", "2-1"]);
  });

  it("links a merged PR to the main run its merge produced", () => {
    const site = build([
      run({ runId: "7-1", sha: "mergesha" }, at(5)),
      run(
        { kind: "merged", branch: "louise-dev", runId: "6-1", pr: { number: 9, title: "Households", mergeSha: "mergesha", mergedAt: at(4) } },
        at(3),
      ),
    ]);
    expect(section(renderSite(site), "merged")).toContain('href="reports/main/7-1/index.html"');
  });

  it("has no main-run link for a merge whose main run isn't recorded", () => {
    const site = build([
      run(
        { kind: "merged", branch: "louise-dev", runId: "6-1", pr: { number: 9, title: "Households", mergeSha: "unknown", mergedAt: at(4) } },
        at(3),
      ),
    ]);
    expect(section(renderSite(site), "merged")).not.toContain("reports/main/");
  });

  it("marks a main run whose report was deleted as expired", () => {
    const runs = Array.from({ length: MAIN_REPORTS_KEPT + 1 }, (_, i) => run({ runId: `${i}-1` }, at(i)));
    const history = section(renderSite(build(runs)), "history");
    expect(history).toContain("expired");
    expect(history).not.toContain('href="reports/main/0-1/index.html"');
    expect(history).toContain('href="reports/main/1-1/index.html"');
  });

  it("labels each AC's status in words, not just color", () => {
    const story: StoryCoverage = {
      story: "SCRUM-18",
      title: "Create Household screen",
      criteria: [
        { id: "AC1", text: "a", verify: "test", status: "passing", tests: [] },
        { id: "AC2", text: "b", verify: "test", status: "failing", tests: [] },
        { id: "AC3", text: "c", verify: "test", status: "untested", tests: [] },
        { id: "AC4", text: "d", verify: "manual", status: "manual", tests: [], note: "UI demo" },
      ],
    };
    const coverage = section(renderSite(build([run({}, at(1), { stories: [story] })])), "coverage").toLowerCase();
    for (const label of ["passing", "failing", "no test yet", "manual"]) expect(coverage).toContain(label);
  });

  it("keeps a duration's number and unit on the same line", () => {
    const html = renderSite(build([run({}, at(1))]));
    expect(section(html, "latest")).toContain("0.4 s");
  });

  it("says which way the latest main run went", () => {
    const failed = run({ runId: "2-1" }, at(2), { outcome: "failed", totals: { total: 10, passed: 9, failed: 1, skipped: 0 } });
    const html = renderSite(build([run({}, at(1)), failed]));
    expect(section(html, "latest")).toContain('data-outcome="failed"');
  });
});
