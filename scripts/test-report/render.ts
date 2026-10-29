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

/** Cells stay on one line, except the `wrap` column (a commit message or PR title), which takes the spare width. */
function table(headers: string[], rows: string[][], wrap: number): string {
  const cell = (c: string, i: number) => (i === wrap ? `<td class="wrap">${c}</td>` : `<td>${c}</td>`);
  const head = headers.map((h) => `<th scope="col">${h}</th>`).join("");
  const body = rows.map((cells) => `<tr>${cells.map(cell).join("")}</tr>`).join("\n");
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
<p class="intro">Each bar is one run on main, oldest on the left. Select a bar to open its report.</p>
<div class="panel chart-panel">
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
</div>
</section>`;
}

const STATUS_LABEL: Record<AcStatus, string> = {
  passing: "Passing",
  failing: "Failing",
  untested: "No test yet",
  manual: "Manual",
};

type Verdict = "accepted" | "not-accepted" | "incomplete";

const VERDICT_LABEL: Record<Verdict, string> = { accepted: "Accepted", "not-accepted": "Not accepted", incomplete: "Incomplete" };

/** An AC's checkbox, like a chore chart filled in with a pen. Always shown beside its status word. */
function box(status: AcStatus): string {
  const shapes: Record<AcStatus, string> = {
    passing: `<rect x="1" y="1" width="14" height="14" rx="3" fill="var(--passed)"/><path d="M4.4 8.3l2.4 2.4 4.8-5.3" fill="none" stroke="var(--on-mark)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
    failing: `<rect x="1" y="1" width="14" height="14" rx="3" fill="var(--failed)"/><path d="M5.3 5.3l5.4 5.4M10.7 5.3l-5.4 5.4" stroke="var(--on-mark)" stroke-width="1.8" stroke-linecap="round"/>`,
    untested: `<rect x="1.75" y="1.75" width="12.5" height="12.5" rx="2.5" fill="none" stroke="var(--skipped)" stroke-width="1.5"/>`,
    manual: `<rect x="1.75" y="1.75" width="12.5" height="12.5" rx="2.5" fill="none" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="2.6 1.9"/><circle cx="8" cy="8" r="1.9" fill="var(--ink-2)"/>`,
  };
  return `<svg class="box" viewBox="0 0 16 16" aria-hidden="true">${shapes[status]}</svg>`;
}

const CHEVRON = `<svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const NO_CHEVRON = `<span class="chev" aria-hidden="true"></span>`;
const NO_GOTO = `<span class="goto" aria-hidden="true"></span>`;

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

/** Why a story has its verdict, in a few words; empty when there's nothing to add. */
function verdictReason(story: StoryCoverage, verdict: Verdict): string {
  const withStatus = (status: AcStatus) => story.criteria.filter((c) => c.status === status).map((c) => c.id);
  if (verdict === "not-accepted") return `${idList(withStatus("failing"))} failing`;
  if (verdict === "incomplete") {
    const untested = withStatus("untested");
    return `${idList(untested)} ${untested.length === 1 ? "has" : "have"} no test yet`;
  }
  const manual = withStatus("manual");
  return manual.length > 0 ? `${idList(manual)} checked manually` : "";
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

/** One AC: its id, text and status, opening to the tests that check it. */
function acRow(story: StoryCoverage, c: StoryCoverage["criteria"][number], report: string | null): string {
  const first = c.tests.find((t: TestRef) => t.id && t.moduleId) ?? c.tests[0];
  const goto = report && first ? gotoLink(report, `${story.story} ${c.id}`, `tag:${story.story}`, first) : NO_GOTO;
  const cells = `<span class="ac-id">${esc(c.id)}</span><span class="ac-text">${esc(c.text)}</span><span class="ac-status">${box(c.status)}${STATUS_LABEL[c.status]}</span>${goto}`;
  const note = c.note ? `<p class="ac-note">${esc(c.note)}</p>` : "";
  const tests = c.tests.length
    ? `<ul class="tests">${c.tests.map((t) => `<li>${esc(t.name)}${t.state === "passed" ? "" : ` <span class="test-state">${t.state}</span>`}</li>`).join("")}</ul>`
    : "";
  if (!note && !tests) return `<li class="ac" data-status="${c.status}"><div class="ac-row">${NO_CHEVRON}${cells}</div></li>`;
  // A failing AC starts open, so the failing test is in view.
  return `<li class="ac" data-status="${c.status}"><details${c.status === "failing" ? " open" : ""}><summary class="ac-row">${CHEVRON}${cells}</summary>
<div class="ac-detail">${note}${tests}</div></details></li>`;
}

/** One story: a row with its AC checkboxes and verdict, opening to its ACs. */
function storyBlock(story: StoryCoverage, report: string | null): string {
  const verdict = verdictOf(story);
  const reason = verdictReason(story, verdict);
  const goto = report && hasTests(story) ? gotoLink(report, story.story, `tag:${story.story}`) : NO_GOTO;
  const boxes = story.criteria.map((c) => `<span title="${esc(`${c.id}: ${STATUS_LABEL[c.status]}`)}">${box(c.status)}</span>`).join("");
  return `<details class="story" data-key="${esc(story.story)}" data-verdict="${verdict}"${verdict === "accepted" ? "" : " open"}>
<summary class="story-row">${CHEVRON}<span class="story-name"><span class="key">${esc(story.story)}</span><span class="title">${esc(story.title)}</span>${reason ? `<span class="reason">${reason}</span>` : ""}</span><span class="boxes" aria-hidden="true">${boxes}</span><span class="pill" data-verdict="${verdict}">${VERDICT_LABEL[verdict]}</span>${goto}</summary>
<ol class="acs">
${story.criteria.map((c) => acRow(story, c, report)).join("\n")}
</ol>
</details>`;
}

/** An epic (or the stories without one): a panel with a header band and its stories. */
function storyGroup(
  kind: "epic" | "group",
  key: string | null,
  title: string,
  stories: StoryCoverage[],
  report: string | null,
): string {
  const verdicts = stories.map(verdictOf);
  const accepted = verdicts.filter((v) => v === "accepted").length;
  const tally = `${accepted} of ${stories.length} ${stories.length === 1 ? "story" : "stories"} accepted`;
  const tested = stories.filter(hasTests).map((s) => s.story);
  const goto =
    kind === "epic" && report && tested.length ? gotoLink(report, `epic ${key ?? title}`, `tag:${tested.join(" or ")}`) : NO_GOTO;
  const segments = stories
    .map((s, i) => `<i data-verdict="${verdicts[i]}" title="${esc(`${s.story}: ${VERDICT_LABEL[verdicts[i]]}`)}"></i>`)
    .join("");
  const name =
    kind === "epic" && key
      ? `<span class="level">Epic</span><span class="key">${esc(key)}</span><span class="title">${esc(title)}</span>`
      : `<span class="title">${esc(title)}</span>`;
  return `<details class="${kind}"${key ? ` data-key="${esc(key)}"` : ""}${accepted === stories.length ? "" : " open"}>
<summary class="group-head">${CHEVRON}<span class="group-name">${name}</span><span class="progress"><span class="segments" aria-hidden="true">${segments}</span><span class="tally">${tally}</span></span>${goto}</summary>
<div class="story-list">
${stories.map((s) => storyBlock(s, report)).join("\n")}
</div>
</details>`;
}

/** "2 of 4 stories accepted. 1 not accepted and 1 incomplete." */
function storiesTotal(stories: StoryCoverage[]): string {
  const count = (v: Verdict) => stories.filter((s) => verdictOf(s) === v).length;
  const rest = [
    count("not-accepted") ? `${count("not-accepted")} not accepted` : "",
    count("incomplete") ? `${count("incomplete")} incomplete` : "",
  ].filter(Boolean);
  const accepted = `${count("accepted")} of ${stories.length} ${stories.length === 1 ? "story" : "stories"} accepted.`;
  return rest.length ? `${accepted} ${rest.join(" and ")}.` : accepted;
}

const MARKS_LEGEND = `<ul class="legend marks" aria-label="What the checkboxes mean">${(["passing", "failing", "untested", "manual"] as const)
  .map((s) => `<li>${box(s)}${STATUS_LABEL[s]}</li>`)
  .join("")}</ul>`;

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
    body = `<div class="story-list panel">\n${loose.map((s) => storyBlock(s, report)).join("\n")}\n</div>`;
  } else {
    const ordered = [...epics.entries()].sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }));
    body = ordered.map(([key, group]) => storyGroup("epic", key, group.title, group.stories, report)).join("\n");
    if (loose.length) body += `\n${storyGroup("group", null, "Stories without an epic", loose, report)}`;
  }

  return `<section id="stories">
${heading}
<p class="intro">The acceptance criteria our tests can check, from the latest run on main, ${time(latest.summary.startedAt)}. Jira is still where stories are tracked.</p>
<div class="stories-head"><p class="total">${storiesTotal(stories)}</p>${MARKS_LEGEND}</div>
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
${table(["Branch", "Result", "Tests", "Last commit", "Tested", "Report"], rows, 3)}
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
${table(["Pull request", "Branch", "Final run", "Tests", "Merged", "Reports"], rows, 0)}
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
${table(["Tested", "Commit", "Result", "Tests", "Time", "Report"], rows, 1)}
</section>`;
}

const STYLES = `
@font-face { font-family: Libron; src: url("assets/fonts/Libron-Regular.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: Libron; src: url("assets/fonts/Libron-Italic.woff2") format("woff2"); font-weight: 400; font-style: italic; font-display: swap; }
@font-face { font-family: Libron; src: url("assets/fonts/Libron-Bold.woff2") format("woff2"); font-weight: 700; font-style: normal; font-display: swap; }
@font-face { font-family: Libron; src: url("assets/fonts/Libron-BoldItalic.woff2") format("woff2"); font-weight: 700; font-style: italic; font-display: swap; }
:root {
  color-scheme: light dark;
  /* Surfaces: the page, panels that hold a dataset or an epic, an epic's header band, and the recessed AC list. */
  --paper: #f2f4f1; --panel: #fbfcfa; --band: #e4e9e3; --well: #f2f4f1;
  --ink: #1c2420; --ink-2: #48534d; --ink-3: #5c6761; --rule: #d3dad4; --rule-strong: #b8c2ba;
  --passed: #3f6fb5; --failed: #d03b3b; --skipped: #848d88; --on-mark: #ffffff;
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #151b18; --panel: #1b221e; --band: #242d28; --well: #151b18;
    --ink: #e5ebe6; --ink-2: #b4beb8; --ink-3: #97a29b; --rule: #2c3530; --rule-strong: #3d4842;
  }
}
* { box-sizing: border-box; }
html { font-size: 18px; }
body { margin: 0; background: var(--paper); color: var(--ink); font-family: Libron, Georgia, serif; line-height: 1.5; font-variant-numeric: tabular-nums; -webkit-text-size-adjust: 100%; }
/* An internal page, laid out for a desktop browser window. */
.page { max-width: 64rem; margin: 0 auto; padding: 2.5rem 2rem 5rem; }
a { color: inherit; text-decoration: underline; text-decoration-color: var(--ink-3); text-decoration-thickness: 1px; text-underline-offset: 0.18em; }
a:hover { text-decoration-color: currentColor; }
:focus-visible { outline: 2px solid var(--passed); outline-offset: 2px; border-radius: 3px; }
code { font-family: inherit; font-weight: 700; }
.masthead { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 0.25rem 1.5rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--rule); }
.masthead h1 { margin: 0; font-size: 1rem; font-weight: 700; }
.masthead p { margin: 0; color: var(--ink-3); font-size: 0.85rem; }
section { margin-top: 4.5rem; }
h2 { margin: 0 0 0.4rem; font-size: 2rem; font-weight: 400; line-height: 1.15; letter-spacing: -0.012em; }
h3 { margin: 0; font-size: 1.1rem; font-weight: 700; line-height: 1.3; }
p { margin: 0 0 0.5rem; max-width: 42rem; }
.intro, .empty, .note { color: var(--ink-2); }
section > .intro { margin-bottom: 1.25rem; }
.note { font-size: 0.85rem; }
.muted { color: var(--ink-3); }
.glyph { width: 1.05em; height: 1.05em; flex: none; }
.status { display: inline-flex; align-items: center; gap: 0.4em; white-space: nowrap; }
/* Jira-style keys (SCRUM-3) in small caps, so they sit quieter than the titles beside them. */
.key { font-variant-caps: all-small-caps; letter-spacing: 0.06em; font-weight: 700; color: var(--ink-2); }

.latest { margin-top: 2.75rem; }
.latest .verdict { display: flex; align-items: center; gap: 0.35em; margin: 0 0 1rem; font-size: 2.667rem; font-weight: 400; line-height: 1.1; letter-spacing: -0.012em; }
.latest .verdict .glyph { width: 0.82em; height: 0.82em; }
.latest .links { display: flex; flex-wrap: wrap; gap: 0.25rem 1.5rem; margin-top: 1rem; }
.problems { margin-top: 1.5rem; padding: 1rem 1.25rem; background: var(--panel); border: 1px solid var(--rule); border-left: 4px solid var(--failed); border-radius: 6px; max-width: 42rem; }
.problems h3 { font-size: 1rem; }
.problems ul { margin: 0.5rem 0 0; padding-left: 1.2rem; font-size: 0.9rem; }

/* Panels hold one dataset each: the chart, an epic, a table. */
.panel, .table-wrap { background: var(--panel); border: 1px solid var(--rule); border-radius: 10px; }

.legend { display: flex; flex-wrap: wrap; gap: 0.25rem 1.25rem; margin: 0 0 0.75rem; padding: 0; list-style: none; font-size: 0.85rem; color: var(--ink-2); }
.swatch { display: inline-block; width: 0.75em; height: 0.75em; margin-right: 0.4em; border-radius: 2px; vertical-align: -0.02em; }
.swatch.passed, .chart .passed { background: var(--passed); fill: var(--passed); }
.swatch.failed, .chart .failed { background: var(--failed); fill: var(--failed); }
.swatch.skipped, .chart .skipped { background: var(--skipped); fill: var(--skipped); }
.chart-panel { padding: 1.1rem 1.25rem 0.6rem; }
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

/* Stories: each epic is a panel with a header band, stories are rows on it, and an
   open story's acceptance criteria sit in a recessed list. Type shrinks a step per level. */
.stories-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 0.5rem 2rem; margin-bottom: 1rem; }
.stories-head .total { margin: 0; font-weight: 700; }
.marks { margin: 0; }
.marks li { display: inline-flex; align-items: center; gap: 0.4em; }
.box { display: block; width: 1rem; height: 1rem; flex: none; }
.tree { display: grid; gap: 1.25rem; }
.tree summary { list-style: none; cursor: pointer; }
.tree summary::-webkit-details-marker { display: none; }
.chev { display: block; width: 1rem; height: 1rem; flex: none; color: var(--ink-3); transition: transform 140ms ease-out; }
details[open] > summary > .chev { transform: rotate(90deg); }
@media (prefers-reduced-motion: reduce) { .chev { transition: none; } }
.goto { display: inline-flex; align-items: center; justify-content: center; width: 1.75rem; height: 1.75rem; flex: none; border-radius: 4px; color: var(--ink-3); text-decoration: none; }
.goto svg { width: 1.05rem; height: 1.05rem; }
a.goto:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 9%, transparent); }

.epic, .group { background: var(--panel); border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; }
.group-head { display: grid; grid-template-columns: 1rem minmax(0, 1fr) auto 1.75rem; align-items: center; gap: 0.85rem; padding: 0.9rem 1rem 0.9rem 1.1rem; background: var(--band); }
.epic[open] > .group-head, .group[open] > .group-head { border-bottom: 1px solid var(--rule-strong); }
.group-name { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 0.6rem; min-width: 0; }
.group-name .level { color: var(--ink-3); font-size: 0.9rem; }
.group-name .key { font-size: 1.1rem; }
.group-name .title { font-size: 1.333rem; font-weight: 700; line-height: 1.2; }
.group .group-name .title { font-weight: 400; font-style: italic; }
.progress { display: flex; align-items: center; gap: 0.75rem; color: var(--ink-2); font-size: 0.85rem; white-space: nowrap; }
.segments { display: flex; gap: 3px; width: 6.5rem; }
.segments i { flex: 1; height: 0.55rem; border-radius: 2px; }
.segments i[data-verdict="accepted"] { background: var(--passed); }
.segments i[data-verdict="not-accepted"] { background: var(--failed); }
.segments i[data-verdict="incomplete"] { box-shadow: inset 0 0 0 1.5px var(--skipped); }

.story-list > .story + .story { border-top: 1px solid var(--rule); }
.story-row { display: grid; grid-template-columns: 1rem minmax(0, 1fr) 7.5rem 8.25rem 1.75rem; align-items: center; gap: 0.85rem; padding: 0.75rem 1rem 0.75rem 1.1rem; }
.story-row:hover { background: color-mix(in srgb, var(--ink) 3%, transparent); }
.story-name { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 0.55rem; min-width: 0; }
.story-name .key { font-size: 0.95rem; }
.story-name .title { font-weight: 700; }
.story-name .reason { flex-basis: 100%; color: var(--ink-2); font-size: 0.8rem; }
.boxes { display: flex; flex-wrap: wrap; gap: 3px; }
.pill { justify-self: start; padding: 0.2rem 0.75rem; border-radius: 999px; font-size: 0.8rem; font-weight: 700; white-space: nowrap; background: color-mix(in srgb, var(--passed) 16%, var(--panel)); }
.pill[data-verdict="not-accepted"] { background: color-mix(in srgb, var(--failed) 16%, var(--panel)); }
.pill[data-verdict="incomplete"] { background: transparent; box-shadow: inset 0 0 0 1px var(--skipped); color: var(--ink-2); }

.acs { list-style: none; margin: 0 1rem 1rem 3rem; padding: 0; background: var(--well); border: 1px solid var(--rule); border-radius: 6px; }
.ac + .ac { border-top: 1px solid var(--rule); }
.ac-row { display: grid; grid-template-columns: 1rem 2.6rem minmax(0, 1fr) 7.25rem 1.75rem; align-items: start; gap: 0.6rem; padding: 0.5rem 0.6rem 0.5rem 0.75rem; font-size: 0.889rem; line-height: 1.45; }
.ac-row > .chev { margin-top: 0.2rem; }
.ac-row > .goto { margin-top: -0.2rem; }
.ac-id { font-weight: 700; color: var(--ink-2); }
.ac-status { display: inline-flex; align-items: center; gap: 0.4em; padding-top: 0.12rem; color: var(--ink-2); font-size: 0.8rem; white-space: nowrap; }
.ac-detail { padding: 0 0.75rem 0.65rem 5.75rem; font-size: 0.8rem; color: var(--ink-3); }
.ac-note { margin: 0; color: var(--ink-2); }
.tests { margin: 0; padding: 0; list-style: none; }
.test-state { font-weight: 700; color: var(--ink-2); }

.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th { padding: 0.6rem 1rem; background: var(--band); border-bottom: 1px solid var(--rule-strong); color: var(--ink-2); font-weight: 700; text-align: left; white-space: nowrap; }
td { padding: 0.7rem 1rem; border-bottom: 1px solid var(--rule); vertical-align: top; white-space: nowrap; }
td.wrap { width: 100%; min-width: 14rem; white-space: normal; }
tbody tr:last-child td { border-bottom: 0; }
td em { color: var(--ink-2); }
.branch { font-weight: 700; }
footer { margin-top: 4.5rem; padding-top: 1rem; border-top: 1px solid var(--rule); color: var(--ink-3); font-size: 0.8rem; }
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
