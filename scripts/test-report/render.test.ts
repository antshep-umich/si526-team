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

const SECTIONS = ["latest", "chart", "stories", "branches", "merged", "history"];

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
      epic: { key: "SCRUM-1", title: evil },
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
    const coverage = section(renderSite(build([run({}, at(1), { stories: [story] })])), "stories").toLowerCase();
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

describe("the Stories section", () => {
  type Ac = StoryCoverage["criteria"][number];
  const ac = (id: string, status: Ac["status"], testIds: string[] = []): Ac => ({
    id,
    text: `${id} text`,
    verify: status === "manual" ? "manual" : "test",
    status,
    tests: testIds.map((testId) => ({
      name: `${id}: a test`,
      state: status === "failing" ? "failed" : "passed",
      id: testId,
      moduleId: "m1",
    })),
  });
  const accounts = { key: "SCRUM-1", title: "Accounts" };
  const households = { key: "SCRUM-10", title: "Households" };
  const stories: StoryCoverage[] = [
    { story: "SCRUM-2", title: "Sign up", epic: accounts, criteria: [ac("AC1", "passing", ["m1_0_0"]), ac("AC2", "manual")] },
    { story: "SCRUM-3", title: "Log in", epic: accounts, criteria: [ac("AC1", "passing", ["m1_1_0"]), ac("AC2", "failing", ["m1_1_1"])] },
    { story: "SCRUM-4", title: "Create a household", epic: households, criteria: [ac("AC1", "passing", ["m1_2_0"]), ac("AC2", "untested")] },
    { story: "SCRUM-9", title: "Settings", criteria: [ac("AC1", "manual")] },
  ];
  const html = renderSite(build([run({}, at(1), { stories })]));
  const storiesHtml = section(html, "stories");

  /** The opening tag of a story's or epic's collapsible block. */
  const openingTag = (kind: "story" | "epic", key: string, within = storiesHtml) => {
    const match = new RegExp(`<details class="${kind}" data-key="${key}"[^>]*>`).exec(within);
    if (!match) throw new Error(`no ${kind} ${key}`);
    return match[0];
  };

  /** A box-with-arrow link, found by its accessible name. */
  const goto = (what: string) =>
    new RegExp(`<a class="goto"[^>]*aria-label="Open the tests for ${what} in the Vitest report"[^>]*>`).exec(storiesHtml)?.[0];

  it("is headed Stories", () => {
    expect(storiesHtml).toContain("<h2>Stories</h2>");
  });

  it("gives each story a verdict in words", () => {
    expect(openingTag("story", "SCRUM-2")).toContain('data-verdict="accepted"');
    expect(openingTag("story", "SCRUM-3")).toContain('data-verdict="not-accepted"');
    expect(openingTag("story", "SCRUM-4")).toContain('data-verdict="incomplete"');
    for (const word of ["Accepted", "Not accepted", "Incomplete"]) expect(storiesHtml).toContain(word);
  });

  it("collapses accepted stories and opens the rest", () => {
    expect(openingTag("story", "SCRUM-2")).not.toMatch(/\sopen[\s>]/);
    expect(openingTag("story", "SCRUM-3")).toMatch(/\sopen[\s>]/);
    expect(openingTag("story", "SCRUM-4")).toMatch(/\sopen[\s>]/);
  });

  it("nests stories under their epics, with stories that have no epic last", () => {
    const order = ["SCRUM-1", "SCRUM-2", "SCRUM-3", "SCRUM-10", "SCRUM-4", "SCRUM-9"].map((key) =>
      storiesHtml.search(new RegExp(`data-key="${key}"`)),
    );
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(storiesHtml).toContain("Stories without an epic");
  });

  it("counts the accepted stories in each epic", () => {
    expect(storiesHtml).toContain("1 of 2 stories accepted");
    expect(storiesHtml).toContain("0 of 1 story accepted");
  });

  it("collapses an epic only when all its stories are accepted", () => {
    const onlyAccepted = section(renderSite(build([run({}, at(1), { stories: [stories[0]] })])), "stories");
    expect(openingTag("epic", "SCRUM-1", onlyAccepted)).not.toMatch(/\sopen[\s>]/);
    expect(openingTag("epic", "SCRUM-1")).toMatch(/\sopen[\s>]/);
  });

  it("lists stories without an epic level when no story has an epic", () => {
    const flat = section(renderSite(build([run({}, at(1), { stories: [{ ...stories[1], epic: undefined }] })])), "stories");
    expect(flat).not.toContain('class="epic"');
    expect(flat).toContain('data-key="SCRUM-3"');
  });

  it("links a story to the latest main report, filtered to its tag", () => {
    const link = goto("SCRUM-3");
    expect(link).toContain('href="reports/main/1-1/index.html#/"');
    expect(link).toContain('data-search="tag:SCRUM-3"');
    expect(link).toContain('target="_blank"');
  });

  it("links an epic to the report filtered to all of its stories", () => {
    expect(goto("epic SCRUM-1")).toContain('data-search="tag:SCRUM-2 or SCRUM-3"');
  });

  it("links an AC to its own test, inside its story's filter", () => {
    const link = goto("SCRUM-3 AC2");
    expect(link).toContain('href="reports/main/1-1/index.html#/?file=m1&amp;test=m1_1_1"');
    expect(link).toContain('data-search="tag:SCRUM-3"');
  });

  it("has no link where there are no tests to show", () => {
    expect(goto("SCRUM-4 AC2")).toBeUndefined();
    expect(goto("SCRUM-9")).toBeUndefined();
  });

  it("clears the report's filter from links that open a whole report", () => {
    expect(section(html, "history")).toMatch(/href="reports\/main\/1-1\/index.html" data-search=""/);
  });
});
