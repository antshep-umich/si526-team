// Renders the dashboard's index.html from data/history.json. Static HTML with a
// little inline script for local times and chart tooltips. TECH_SPEC section 15.
import type { AcStatus, RunMeta, RunSummary, SiteData, SiteEntry, StoryCoverage, Totals } from "./types.ts";

/** How many main runs the chart shows. The history table lists them all. */
const CHART_RUNS = 40;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const esc = escapeHtml;

function link(href: string, html: string): string {
  return `<a href="${esc(href)}">${html}</a>`;
}

// Linking the file itself (not the folder) also works when the page is opened from disk.
const reportHref = (report: string) => `${report}/index.html`;

/** A link to a whole report. The empty data-search clears any filter a story link left behind. */
function reportLink(report: string, html: string): string {
  return `<a href="${esc(reportHref(report))}" data-search="">${html}</a>`;
}

function utcText(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const text = date.toLocaleString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${text} UTC`;
}

/** UTC in the HTML; the page's script swaps in the reader's local time. */
function time(iso: string | null): string {
  return iso ? `<time datetime="${esc(iso)}">${esc(utcText(iso))}</time>` : "";
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
}

/** Non-breaking spaces keep "0.7 s" together when a sentence wraps. */
function seconds(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`;
}

function commit(meta: RunMeta): string {
  const short = esc(meta.sha.slice(0, 7));
  if (!meta.sha) return "";
  return meta.repoUrl ? link(`${meta.repoUrl}/commit/${meta.sha}`, short) : short;
}

function testsText(totals: Totals): string {
  const skipped = totals.skipped ? `, ${totals.skipped} skipped` : "";
  return `${totals.passed} of ${totals.total} passed${skipped}`;
}

type Mark = "pass" | "fail" | "none" | "manual";

/** Status marks always sit next to a word, so color is never the only signal. */
function glyph(mark: Mark): string {
  const shapes: Record<Mark, string> = {
    pass: `<circle cx="10" cy="10" r="9" fill="var(--passed)"/><path d="M5.6 10.4l3 3 5.8-6.6" fill="none" stroke="var(--on-mark)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    fail: `<circle cx="10" cy="10" r="9" fill="var(--failed)"/><path d="M6.8 6.8l6.4 6.4M13.2 6.8l-6.4 6.4" stroke="var(--on-mark)" stroke-width="2" stroke-linecap="round"/>`,
    none: `<circle cx="10" cy="10" r="8" fill="none" stroke="var(--skipped)" stroke-width="2"/>`,
    manual: `<circle cx="10" cy="10" r="8" fill="none" stroke="var(--ink-2)" stroke-width="2"/><circle cx="10" cy="10" r="3" fill="var(--ink-2)"/>`,
  };
  return `<svg class="glyph" viewBox="0 0 20 20" aria-hidden="true">${shapes[mark]}</svg>`;
}

function outcome(summary: RunSummary): string {
  const passed = summary.outcome === "passed";
  return `<span class="status">${glyph(passed ? "pass" : "fail")}<span>${passed ? "Passed" : "Failed"}</span></span>`;
}

function emptyNote(text: string): string {
  return `<p class="empty">${text}</p>`;
}

function table(headers: string[], rows: string[][]): string {
  const head = headers.map((h) => `<th scope="col">${h}</th>`).join("");
  const body = rows.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("\n");
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>\n${body}\n</tbody></table></div>`;
}

function latestSection(site: SiteData): string {
  const latest = site.main[0];
  if (!latest) {
    return `<section id="latest" class="latest">
<h2 class="verdict">No runs on main yet.</h2>
${emptyNote("The first one appears after the next push to main, which usually means a pull request merging.")}
</section>`;
  }

  const s = latest.summary;
  const passed = s.outcome === "passed";
  const { total, failed, skipped } = s.totals;
  let result: string;
  if (failed > 0) result = `${failed} of ${total} tests failed on the latest run.`;
  else if (!passed) result = "No test failed, but the run reported an error. The full report has the details.";
  else result = `All ${total - skipped} tests that ran passed on the latest run.`;
  if (skipped > 0) result += ` ${skipped} ${skipped === 1 ? "was" : "were"} skipped.`;

  const message = s.meta.message ? `, <em>${esc(s.meta.message)}</em>` : "";
  const commitText = s.meta.sha ? `Commit ${commit(s.meta)}${message}, tested ${time(s.startedAt)} in ${seconds(s.durationMs)}.` : "";
  const links = [
    latest.report ? reportLink(latest.report, "Open the full report") : "",
    s.meta.runUrl ? link(s.meta.runUrl, "See the workflow run") : "",
  ].filter(Boolean);

  const problems =
    s.problems.length === 0
      ? ""
      : `<div class="problems">
<h3><span class="status">${glyph("fail")}<span>${s.problems.length} ${s.problems.length === 1 ? "problem" : "problems"} with AC files or test tags</span></span></h3>
<ul>${s.problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
</div>`;

  return `<section id="latest" class="latest" data-outcome="${s.outcome}">
<h2 class="verdict">${glyph(passed ? "pass" : "fail")}<span>Main is ${passed ? "passing" : "failing"}.</span></h2>
<p>${result}</p>
<p>${commitText}</p>
${links.length ? `<p class="links">${links.join("")}</p>` : ""}
${problems}
</section>`;
}

/** Rounds up to 1, 2 or 5 times a power of ten. */
function niceCeil(value: number): number {
  if (value <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const m of [1, 2, 5, 10]) if (m * power >= value) return m * power;
  return 10 * power;
}

function chartSection(site: SiteData): string {
  const heading = `<h2>Tests on main, run by run</h2>`;
  const entries = site.main.slice(0, CHART_RUNS).reverse();
  if (entries.length === 0) {
    return `<section id="chart">${heading}${emptyNote("The chart starts with the first run on main.")}</section>`;
  }

  // Bars are drawn in a stretched SVG; text stays in HTML so it's readable at any width.
  const width = 1000;
  const height = 200;
  const top = 8;
  const plot = height - top;
  const step = niceCeil(Math.max(...entries.map((e) => e.summary.totals.total)) / 4);
  const ticks = Array.from({ length: Math.ceil(Math.max(...entries.map((e) => e.summary.totals.total), 1) / step) + 1 }, (_, i) => i * step);
  const yMax = ticks[ticks.length - 1];
  const yOf = (v: number) => top + plot - (v / yMax) * plot;

  const slots = Math.max(entries.length, 20);
  const slotWidth = width / slots;
  const barWidth = Math.min(28, slotWidth * 0.68);
  const first = slots - entries.length;

  const grid = ticks.map((t) => `<line class="grid" x1="0" x2="${width}" y1="${yOf(t)}" y2="${yOf(t)}"/>`).join("");
  const tickLabels = ticks.map((t) => `<span class="tick" style="top:${yOf(t)}px">${t}</span>`).join("");

  const bars = entries.map((entry, i) => {
    const s = entry.summary;
    const x = (first + i) * slotWidth;
    const barX = x + (slotWidth - barWidth) / 2;
    const parts = (
      [
        ["passed", s.totals.passed],
        ["skipped", s.totals.skipped],
        ["failed", s.totals.failed],
      ] as const
    ).filter(([, n]) => n > 0);

    let cursor = top + plot;
    const segments = parts.map(([kind, n], index) => {
      if (index > 0) cursor -= 2; // surface gap between stacked segments
      const h = Math.max(3, (n / yMax) * plot); // a single failure stays visible
      const y = cursor - h;
      cursor = y;
      if (index < parts.length - 1) {
        return `<rect class="${kind}" x="${barX}" y="${y}" width="${barWidth}" height="${h}"/>`;
      }
      const r = Math.min(4, h / 2, barWidth / 2);
      const right = barX + barWidth;
      return `<path class="${kind}" d="M${barX},${y + h}V${y + r}Q${barX},${y} ${barX + r},${y}H${right - r}Q${right},${y} ${right},${y + r}V${y + h}Z"/>`;
    });

    const tip = `${s.totals.passed} passed, ${s.totals.failed} failed, ${s.totals.skipped} skipped\n${s.meta.sha.slice(0, 7)} ${s.meta.message}`;
    const hit = `<rect class="hit" x="${x}" y="0" width="${slotWidth}" height="${height}"><title>${esc(`${utcText(s.startedAt)}\n${tip}`)}</title></rect>`;
    const inner = `${segments.join("")}${hit}`;
    const attrs = `class="bar" data-run="${esc(s.meta.runId)}" data-time="${esc(s.startedAt)}" data-tip="${esc(tip)}"`;
    return entry.report
      ? `<a ${attrs} href="${esc(reportHref(entry.report))}" data-search="" aria-label="${esc(`Report for ${utcText(s.startedAt)}`)}">${inner}</a>`
      : `<g ${attrs}>${inner}</g>`;
  });

  const pct = (i: number) => (((first + i) * slotWidth + slotWidth / 2) / width) * 100;
  const dates =
    entries.length === 1
      ? `<span style="left:${pct(0)}%">${esc(shortDate(entries[0].summary.startedAt))}</span>`
      : `<span style="left:${pct(0)}%">${esc(shortDate(entries[0].summary.startedAt))}</span><span style="left:${pct(entries.length - 1)}%">${esc(shortDate(entries[entries.length - 1].summary.startedAt))}</span>`;

  return `<section id="chart">
${heading}
<ul class="legend">
<li><span class="swatch passed"></span>Passed</li>
<li><span class="swatch failed"></span>Failed</li>
<li><span class="swatch skipped"></span>Skipped</li>
</ul>
<div class="chart">
<div class="ticks" aria-hidden="true">${tickLabels}</div>
<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Passed, failed and skipped tests for the last ${entries.length} runs on main. The history table below has the same numbers.">
${grid}
${bars.join("\n")}
</svg>
<div class="dates" aria-hidden="true">${dates}</div>
</div>
<p class="note">Each bar is one run, oldest on the left. Select a bar to open its report.</p>
</section>`;
}

const STATUS_LABEL: Record<AcStatus, string> = {
  passing: "Passing",
  failing: "Failing",
  untested: "No test yet",
  manual: "Manual",
};

const STATUS_MARK: Record<AcStatus, Mark> = { passing: "pass", failing: "fail", untested: "none", manual: "manual" };

type Verdict = "accepted" | "not-accepted" | "incomplete";

const VERDICT_LABEL: Record<Verdict, string> = { accepted: "Accepted", "not-accepted": "Not accepted", incomplete: "Incomplete" };
const VERDICT_MARK: Record<Verdict, Mark> = { accepted: "pass", "not-accepted": "fail", incomplete: "none" };

/** Accepted when every AC is met. Manual ACs count as met: they're checked outside these tests. */
function verdictOf(story: StoryCoverage): Verdict {
  if (story.criteria.some((c) => c.status === "failing")) return "not-accepted";
  if (story.criteria.some((c) => c.status === "untested")) return "incomplete";
  return "accepted";
}

/** "AC2", "AC2 and AC4", "AC1, AC2 and AC4". */
function idList(ids: string[]): string {
  return ids.length < 2 ? ids.join("") : `${ids.slice(0, -1).join(", ")} and ${ids[ids.length - 1]}`;
}

function verdictText(story: StoryCoverage, verdict: Verdict): string {
  const withStatus = (status: AcStatus) => story.criteria.filter((c) => c.status === status).map((c) => c.id);
  const label = VERDICT_LABEL[verdict];
  if (verdict === "not-accepted") return `${label}: ${idList(withStatus("failing"))} failing`;
  if (verdict === "incomplete") {
    const untested = withStatus("untested");
    return `${label}: ${idList(untested)} ${untested.length === 1 ? "has" : "have"} no test yet`;
  }
  const manual = withStatus("manual").length;
  return manual > 0 ? `${label}, with ${manual} checked manually` : label;
}

const GOTO_ICON = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M11.5 3.5h5v5M16.5 3.5l-7.5 7.5M14 11.5v4a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

type TestRef = { id?: string; moduleId?: string };

/**
 * The box-with-arrow link that opens the Vitest report showing these tests.
 * The report reads its search from local storage, so the page's script stores
 * `data-search` there on click; a test link also opens that test directly.
 */
function gotoLink(report: string, what: string, search: string, test?: TestRef): string {
  const hash =
    test?.id && test.moduleId ? `#/?file=${encodeURIComponent(test.moduleId)}&test=${encodeURIComponent(test.id)}` : "#/";
  const label = `Open the tests for ${what} in the Vitest report`;
  return `<a class="goto" href="${esc(reportHref(report) + hash)}" target="_blank" rel="noopener" data-search="${esc(search)}" aria-label="${esc(label)}" title="${esc(label)}">${GOTO_ICON}</a>`;
}

const hasTests = (story: StoryCoverage) => story.criteria.some((c) => c.tests.length > 0);

function criterionRow(story: StoryCoverage, c: StoryCoverage["criteria"][number], report: string | null): string {
  const first = c.tests.find((t: TestRef) => t.id && t.moduleId) ?? c.tests[0];
  const goto = report && first ? gotoLink(report, `${story.story} ${c.id}`, `tag:${story.story}`, first) : "";
  const line = `${glyph(STATUS_MARK[c.status])}<span class="label"><span class="ac">${esc(c.id)}</span> ${esc(c.text)}<span class="state">${STATUS_LABEL[c.status]}</span></span>${goto}`;
  const note = c.note ? `<p class="note">${esc(c.note)}</p>` : "";
  const tests = c.tests.length
    ? `<ul class="tests">${c.tests.map((t) => `<li>${esc(t.name)}${t.state === "passed" ? "" : ` (${t.state})`}</li>`).join("")}</ul>`
    : "";
  if (!note && !tests) return `<li class="criterion" data-status="${c.status}"><div class="line">${line}</div></li>`;
  // A failing AC starts open, so the failing test is in view.
  return `<li class="criterion" data-status="${c.status}"><details${c.status === "failing" ? " open" : ""}><summary class="line">${line}</summary>
<div class="detail">${note}${tests}</div></details></li>`;
}

function storyBlock(story: StoryCoverage, report: string | null): string {
  const verdict = verdictOf(story);
  const goto = report && hasTests(story) ? gotoLink(report, story.story, `tag:${story.story}`) : "";
  return `<details class="story" data-key="${esc(story.story)}" data-verdict="${verdict}"${verdict === "accepted" ? "" : " open"}>
<summary class="line">${glyph(VERDICT_MARK[verdict])}<span class="label"><span class="key">${esc(story.story)}</span> <span class="title">${esc(story.title)}</span><span class="state">${verdictText(story, verdict)}</span></span>${goto}</summary>
<ul class="criteria">
${story.criteria.map((c) => criterionRow(story, c, report)).join("\n")}
</ul>
</details>`;
}

function storyGroup(
  kind: "epic" | "group",
  key: string | null,
  title: string,
  stories: StoryCoverage[],
  report: string | null,
): string {
  const accepted = stories.filter((s) => verdictOf(s) === "accepted").length;
  const tally = `${accepted} of ${stories.length} ${stories.length === 1 ? "story" : "stories"} accepted`;
  const tested = stories.filter(hasTests).map((s) => s.story);
  const goto = report && tested.length ? gotoLink(report, `epic ${key ?? title}`, `tag:${tested.join(" or ")}`) : "";
  const keyAttr = key ? ` data-key="${esc(key)}"` : "";
  const keyText = key ? `<span class="key">${esc(key)}</span> ` : "";
  return `<details class="${kind}"${keyAttr}${accepted === stories.length ? "" : " open"}>
<summary class="line"><span class="label">${keyText}<span class="title">${esc(title)}</span><span class="state">${tally}</span></span>${kind === "epic" ? goto : ""}</summary>
${stories.map((s) => storyBlock(s, report)).join("\n")}
</details>`;
}

function storiesSection(site: SiteData): string {
  const heading = `<h2>Stories</h2>`;
  const latest = site.main[0];
  if (!latest) {
    return `<section id="stories">${heading}${emptyNote("Stories appear after the first run on main.")}</section>`;
  }
  const { stories } = latest.summary;
  if (stories.length === 0) {
    return `<section id="stories">${heading}${emptyNote(
      "No stories have acceptance criteria yet. Add a file to <code>acceptance/</code> for each Jira story and tag its tests; <code>acceptance/README.md</code> explains how.",
    )}</section>`;
  }

  const report = latest.report;
  const epics = new Map<string, { title: string; stories: StoryCoverage[] }>();
  const loose: StoryCoverage[] = [];
  for (const story of stories) {
    if (!story.epic) {
      loose.push(story);
      continue;
    }
    const group = epics.get(story.epic.key) ?? { title: story.epic.title, stories: [] };
    group.stories.push(story);
    epics.set(story.epic.key, group);
  }

  let body: string;
  if (epics.size === 0) {
    body = loose.map((s) => storyBlock(s, report)).join("\n");
  } else {
    const ordered = [...epics.entries()].sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }));
    body = ordered.map(([key, group]) => storyGroup("epic", key, group.title, group.stories, report)).join("\n");
    if (loose.length) body += `\n${storyGroup("group", null, "Stories without an epic", loose, report)}`;
  }

  return `<section id="stories">
${heading}
<p class="intro">The acceptance criteria our tests can check, from the latest run on main, ${time(latest.summary.startedAt)}. Jira is still where stories are tracked.</p>
<div class="tree">
${body}
</div>
</section>`;
}

function reportCell(entry: SiteEntry): string {
  return entry.report ? reportLink(entry.report, "Open report") : `<span class="muted">expired</span>`;
}

function commitCell(meta: RunMeta): string {
  const message = meta.message ? ` <em>${esc(meta.message)}</em>` : "";
  return `${commit(meta)}${message}`;
}

function branchesSection(site: SiteData): string {
  const heading = `<h2>Branches in progress</h2>`;
  if (site.branches.length === 0) {
    return `<section id="branches">${heading}${emptyNote("No branches are being tested right now. A branch shows up here after its first push.")}</section>`;
  }
  const rows = site.branches.map((e) => [
    `<span class="branch">${esc(e.summary.meta.branch)}</span>`,
    outcome(e.summary),
    testsText(e.summary.totals),
    commitCell(e.summary.meta),
    time(e.summary.startedAt),
    reportCell(e),
  ]);
  return `<section id="branches">
${heading}
<p class="intro">The latest push to each branch. A branch drops off this list when it's deleted.</p>
${table(["Branch", "Result", "Tests", "Last commit", "Tested", "Report"], rows)}
</section>`;
}

function mergedSection(site: SiteData): string {
  const heading = `<h2>Merged branches</h2>`;
  if (site.merged.length === 0) {
    return `<section id="merged">${heading}${emptyNote("No pull requests have merged since the dashboard started.")}</section>`;
  }
  const rows = site.merged.map((e) => {
    const { meta } = e.summary;
    const pr = meta.pr;
    const number = pr ? `#${pr.number}` : "";
    const prCell = `${pr && meta.repoUrl ? link(`${meta.repoUrl}/pull/${pr.number}`, number) : number} ${esc(pr?.title ?? "")}`;
    const after = pr?.mergeSha ? site.main.find((m) => m.summary.meta.sha === pr.mergeSha) : undefined;
    const afterLink = !after
      ? ""
      : after.report
        ? reportLink(after.report, "Main after merge")
        : after.summary.meta.runUrl
          ? link(after.summary.meta.runUrl, "Main after merge")
          : "";
    const reports = [e.report ? reportLink(e.report, "Final run") : "", afterLink].filter(Boolean);
    return [
      prCell,
      `<span class="branch">${esc(meta.branch)}</span>`,
      outcome(e.summary),
      testsText(e.summary.totals),
      time(pr?.mergedAt ?? null),
      reports.join("<br>"),
    ];
  });
  return `<section id="merged">
${heading}
<p class="intro">Each branch's final run before its pull request merged. These are kept permanently.</p>
${table(["Pull request", "Branch", "Final run", "Tests", "Merged", "Reports"], rows)}
</section>`;
}

function historySection(site: SiteData): string {
  const heading = `<h2>History of main</h2>`;
  if (site.main.length === 0) {
    return `<section id="history">${heading}${emptyNote("No runs on main yet.")}</section>`;
  }
  const rows = site.main.map((e) => [
    time(e.summary.startedAt),
    commitCell(e.summary.meta),
    outcome(e.summary),
    testsText(e.summary.totals),
    seconds(e.summary.durationMs),
    reportCell(e),
  ]);
  return `<section id="history">
${heading}
<p class="intro">Every run on main, newest first. Full reports are kept for the newest 30.</p>
${table(["Tested", "Commit", "Result", "Tests", "Time", "Report"], rows)}
</section>`;
}

const STYLES = `
@font-face { font-family: Libron; src: url("assets/fonts/Libron-Regular.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: Libron; src: url("assets/fonts/Libron-Italic.woff2") format("woff2"); font-weight: 400; font-style: italic; font-display: swap; }
@font-face { font-family: Libron; src: url("assets/fonts/Libron-Bold.woff2") format("woff2"); font-weight: 700; font-style: normal; font-display: swap; }
@font-face { font-family: Libron; src: url("assets/fonts/Libron-BoldItalic.woff2") format("woff2"); font-weight: 700; font-style: italic; font-display: swap; }
:root {
  color-scheme: light dark;
  --paper: #f2f4f1; --ink: #1c2420; --ink-2: #48534d; --ink-3: #5c6761; --rule: #d3dad4;
  --passed: #3f6fb5; --failed: #d03b3b; --skipped: #848d88; --on-mark: #ffffff;
}
@media (prefers-color-scheme: dark) {
  :root { --paper: #151b18; --ink: #e5ebe6; --ink-2: #b4beb8; --ink-3: #97a29b; --rule: #2c3530; }
}
* { box-sizing: border-box; }
html { font-size: 18px; }
body { margin: 0; background: var(--paper); color: var(--ink); font-family: Libron, Georgia, serif; line-height: 1.5; font-variant-numeric: tabular-nums; -webkit-text-size-adjust: 100%; }
/* An internal page, laid out for a desktop browser window. */
.page { max-width: 64rem; margin: 0 auto; padding: 2.5rem 2rem 5rem; }
a { color: inherit; text-decoration: underline; text-decoration-color: var(--ink-3); text-decoration-thickness: 1px; text-underline-offset: 0.18em; }
a:hover { text-decoration-color: currentColor; }
:focus-visible { outline: 2px solid var(--passed); outline-offset: 2px; border-radius: 2px; }
code { font-family: inherit; font-weight: 700; }
.masthead { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 0.25rem 1.5rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--rule); }
.masthead h1 { margin: 0; font-size: 1rem; font-weight: 700; }
.masthead p { margin: 0; color: var(--ink-3); font-size: 0.85rem; }
section { margin-top: 3.5rem; }
h2 { margin: 0 0 0.75rem; font-size: 1.333rem; font-weight: 700; line-height: 1.25; }
h3 { margin: 0; font-size: 1.1rem; font-weight: 700; line-height: 1.3; }
p { margin: 0 0 0.5rem; max-width: 42rem; }
.intro, .empty, .note { color: var(--ink-2); }
.note { font-size: 0.85rem; }
.muted { color: var(--ink-3); }
.glyph { width: 1.05em; height: 1.05em; flex: none; }
.status { display: inline-flex; align-items: center; gap: 0.4em; white-space: nowrap; }
.latest { margin-top: 2.5rem; }
.latest .verdict { display: flex; align-items: center; gap: 0.35em; margin: 0 0 1rem; font-size: 2.667rem; font-weight: 400; line-height: 1.1; letter-spacing: -0.01em; }
.latest .verdict .glyph { width: 0.82em; height: 0.82em; }
.latest .links { display: flex; flex-wrap: wrap; gap: 0.25rem 1.5rem; margin-top: 1rem; }
.problems { margin-top: 1.5rem; padding: 1rem 1.25rem; border: 1px solid var(--rule); border-left: 4px solid var(--failed); border-radius: 4px; max-width: 42rem; }
.problems h3 { font-size: 1rem; }
.problems ul { margin: 0.5rem 0 0; padding-left: 1.2rem; font-size: 0.9rem; }
.legend { display: flex; flex-wrap: wrap; gap: 0.25rem 1.25rem; margin: 0 0 0.75rem; padding: 0; list-style: none; font-size: 0.85rem; color: var(--ink-2); }
.swatch { display: inline-block; width: 0.75em; height: 0.75em; margin-right: 0.4em; border-radius: 2px; vertical-align: -0.02em; }
.swatch.passed, .chart .passed { background: var(--passed); fill: var(--passed); }
.swatch.failed, .chart .failed { background: var(--failed); fill: var(--failed); }
.swatch.skipped, .chart .skipped { background: var(--skipped); fill: var(--skipped); }
.chart { position: relative; padding-left: 2.25rem; }
.chart svg { display: block; width: 100%; height: 200px; overflow: visible; }
.chart .grid { stroke: var(--rule); stroke-width: 1; vector-effect: non-scaling-stroke; }
.chart .hit { fill: transparent; }
.chart .bar:hover .hit, .chart .bar:focus-visible .hit { fill: var(--ink); fill-opacity: 0.06; }
.chart .bar:focus-visible { outline: none; }
.ticks { position: absolute; left: 0; top: 0; width: 1.75rem; height: 200px; }
.tick, .dates span { position: absolute; font-size: 0.75rem; color: var(--ink-3); line-height: 1; }
.tick { right: 0; transform: translateY(-50%); }
.dates { position: relative; height: 1.4rem; margin-top: 0.35rem; }
.dates span { top: 0; transform: translateX(-50%); white-space: nowrap; }
.tip { position: fixed; z-index: 10; max-width: 22rem; padding: 0.45rem 0.65rem; border-radius: 4px; background: var(--ink); color: var(--paper); font-size: 0.8rem; line-height: 1.4; white-space: pre-line; pointer-events: none; }
.tree { max-width: 52rem; margin-top: 1rem; border-bottom: 1px solid var(--rule); }
.tree summary { list-style: none; cursor: pointer; }
.tree summary::-webkit-details-marker { display: none; }
.line { display: flex; align-items: flex-start; gap: 0.6rem; padding: 0.65rem 0; }
.line .label { flex: 1; min-width: 0; }
.line .state { display: block; margin-top: 0.1rem; color: var(--ink-2); font-size: 0.85rem; font-weight: 400; }
.line .glyph { width: 1.2rem; height: 1.2rem; margin-top: 0.12rem; }
.line .key { margin-right: 0.3em; color: var(--ink-2); font-weight: 700; }
.line .title { font-weight: 700; }
/* A chevron marks rows that open and close; rows without one keep the same indent. */
.tree summary.line::before, .tree div.line::before { content: ""; flex: none; width: 0.45rem; height: 0.45rem; margin: 0.5rem 0.15rem 0 0.1rem; }
.tree summary.line::before { border-right: 2px solid var(--ink-3); border-bottom: 2px solid var(--ink-3); transform: rotate(-45deg); transition: transform 120ms ease-out; }
.tree details[open] > summary.line::before { transform: rotate(45deg); }
@media (prefers-reduced-motion: reduce) { .tree summary.line::before { transition: none; } }
.epic, .group, .tree > .story { border-top: 1px solid var(--ink-3); }
.epic > summary .title, .group > summary .title { font-size: 1.1rem; }
.epic > .story, .group > .story { margin-left: 1.5rem; border-top: 1px solid var(--rule); }
.criteria { margin: 0 0 0.4rem 1.5rem; padding: 0; list-style: none; }
.criterion { border-top: 1px solid var(--rule); }
.criterion .line { padding: 0.5rem 0; }
.criterion .ac { font-weight: 700; margin-right: 0.3em; }
.criterion .detail { margin: 0 0 0.6rem 3.15rem; }
.criterion .note { margin: 0; }
.tests { margin: 0.15rem 0 0; padding: 0; list-style: none; font-size: 0.8rem; color: var(--ink-3); }
.goto { flex: none; display: inline-flex; padding: 0.2rem; margin-top: 0.05rem; border-radius: 3px; color: var(--ink-3); text-decoration: none; }
.goto svg { width: 1.05rem; height: 1.05rem; }
.goto:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 8%, transparent); }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th { padding: 0.5rem 1rem 0.5rem 0; border-bottom: 1px solid var(--ink-3); color: var(--ink-2); font-weight: 700; text-align: left; white-space: nowrap; }
td { padding: 0.65rem 1rem 0.65rem 0; border-bottom: 1px solid var(--rule); vertical-align: top; }
td:last-child, th:last-child { padding-right: 0; }
td em { color: var(--ink-2); }
.branch { font-weight: 700; overflow-wrap: anywhere; }
footer { margin-top: 4rem; padding-top: 1rem; border-top: 1px solid var(--rule); color: var(--ink-3); font-size: 0.8rem; }
`;

const SCRIPT = `
(() => {
  // Vitest's HTML report keeps its search in local storage under this key (Vitest 5).
  // Links with data-search set it just before the report opens: "tag:SCRUM-3" shows
  // that story's tests, "" clears it. If Vitest renames the key, the links still open
  // the report, just unfiltered.
  const FILTER_KEY = "vitest-ui_task-tree-filter";
  const remember = (event) => {
    const a = event.target.closest && event.target.closest("a[data-search]");
    if (!a) return;
    try {
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem(FILTER_KEY) || "{}") || {}; } catch {}
      localStorage.setItem(FILTER_KEY, JSON.stringify({
        ...saved,
        failed: false, success: false, skipped: false, slow: false, onlyTests: false,
        search: a.dataset.search,
        project: "__vitest_ui_all_projects__",
      }));
    } catch {}
  };
  document.addEventListener("click", remember);
  document.addEventListener("auxclick", remember);

  const format = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
  const local = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : format.format(d); };
  for (const t of document.querySelectorAll("time[datetime]")) { const text = local(t.getAttribute("datetime")); if (text) t.textContent = text; }
  const tip = document.querySelector(".tip");
  for (const title of document.querySelectorAll(".chart title")) title.remove();
  const show = (bar, x, y) => {
    tip.textContent = local(bar.dataset.time) + "\\n" + bar.dataset.tip;
    tip.hidden = false;
    tip.style.left = Math.max(8, Math.min(x + 12, innerWidth - tip.offsetWidth - 8)) + "px";
    tip.style.top = (y - tip.offsetHeight - 12 < 8 ? y + 18 : y - tip.offsetHeight - 12) + "px";
  };
  const hide = () => { tip.hidden = true; };
  for (const bar of document.querySelectorAll(".chart .bar")) {
    bar.addEventListener("pointermove", (e) => show(bar, e.clientX, e.clientY));
    bar.addEventListener("pointerleave", hide);
    bar.addEventListener("focus", () => { const r = bar.getBoundingClientRect(); show(bar, r.left + r.width / 2, r.top + 40); });
    bar.addEventListener("blur", hide);
  }
})();
`;

/** The whole dashboard page. Every piece of text from runs, tests or Jira is escaped. */
export function renderSite(site: SiteData): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>JAALS test results</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Ccircle cx='10' cy='10' r='9' fill='%233f6fb5'/%3E%3Cpath d='M5.6 10.4l3 3 5.8-6.6' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<meta name="description" content="Test results for the JAALS chore tracker: the latest run on main, acceptance criteria by Jira story, branches in progress and merged branches.">
<style>${STYLES}</style>
</head>
<body>
<div class="page">
<header class="masthead">
<h1>JAALS test results</h1>
<p>Updated ${time(site.updatedAt)}</p>
</header>
<main>
${latestSection(site)}
${chartSection(site)}
${storiesSection(site)}
${branchesSection(site)}
${mergedSection(site)}
${historySection(site)}
</main>
<footer>
<p>The Tests workflow updates this page after each push. Tests run on every branch; acceptance criteria come from the files in <code>acceptance/</code>.</p>
</footer>
</div>
<div class="tip" hidden></div>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
