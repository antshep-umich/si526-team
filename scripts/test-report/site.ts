import { createHash } from "node:crypto";
import type { RunSummary, SiteData, SiteEntry } from "./types.ts";

/** How many main runs keep their full HTML report. Older rows keep their numbers. */
export const MAIN_REPORTS_KEPT = 30;

export function emptySite(now: string): SiteData {
  return { version: 1, updatedAt: now, main: [], branches: [], merged: [] };
}

/** Reads data/history.json. Throws rather than guess, so a bad file is never overwritten with an empty history. */
export function parseSite(text: string): SiteData {
  const data: unknown = JSON.parse(text);
  const ok =
    typeof data === "object" &&
    data !== null &&
    "version" in data &&
    data.version === 1 &&
    "main" in data &&
    Array.isArray(data.main) &&
    "branches" in data &&
    Array.isArray(data.branches) &&
    "merged" in data &&
    Array.isArray(data.merged);
  if (!ok) throw new Error("data/history.json isn't a version 1 test history, so it won't be overwritten");
  return data as SiteData;
}

function pathSegment(text: string): string {
  return text.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[.-]+/, "");
}

/** A folder name for a branch: readable, URL-safe, and distinct even when two names clean up the same way. */
export function branchSlug(branch: string): string {
  const readable = pathSegment(branch).replace(/\.\.+/g, ".").slice(0, 50) || "branch";
  const hash = createHash("sha256").update(branch).digest("hex").slice(0, 8);
  return `${readable}-${hash}`;
}

function reportDirFor(summary: RunSummary): string {
  const { kind, runId, branch, pr } = summary.meta;
  switch (kind) {
    case "main":
      return `reports/main/${pathSegment(runId)}`;
    case "branch":
      return `reports/branches/${branchSlug(branch)}/${pathSegment(runId)}`;
    case "merged":
      if (!pr) throw new Error("A merged run needs its pull request details");
      return `reports/merged/pr-${pr.number}`;
    default:
      throw new Error(`${kind} runs aren't published to the dashboard`);
  }
}

const newestFirst = (time: (e: SiteEntry) => string) => (a: SiteEntry, b: SiteEntry) =>
  Date.parse(time(b)) - Date.parse(time(a));
const byStart = newestFirst((e) => e.summary.startedAt);
const byMerge = newestFirst((e) => e.summary.meta.pr?.mergedAt ?? e.summary.startedAt);

/**
 * Adds one run to the history. Returns the new history and the folder to copy
 * the run's report into, or null when the run shouldn't change anything (an
 * older run for a branch that already has a newer one).
 */
export function applyRun(site: SiteData, summary: RunSummary, now: string): { site: SiteData; reportDir: string | null } {
  const dir = reportDirFor(summary);
  const next: SiteData = { ...structuredClone(site), updatedAt: now };
  const { kind, runId, branch, pr } = summary.meta;

  if (kind === "main") {
    next.main = [...next.main.filter((e) => e.summary.meta.runId !== runId), { summary, report: dir }]
      .sort(byStart)
      .map((e, i) => (i < MAIN_REPORTS_KEPT ? e : { ...e, report: null }));
    const added = next.main.find((e) => e.summary.meta.runId === runId);
    return { site: next, reportDir: added?.report ?? null };
  }

  if (kind === "branch") {
    const current = next.branches.find((e) => e.summary.meta.branch === branch);
    // Publishes can finish out of order; never let an older push replace a newer one.
    if (current && Date.parse(current.summary.startedAt) > Date.parse(summary.startedAt)) {
      return { site, reportDir: null };
    }
    next.branches = [...next.branches.filter((e) => e !== current), { summary, report: dir }].sort(byStart);
    return { site: next, reportDir: dir };
  }

  // Merged: keyed by PR number, because a branch name can be reused after a merge.
  next.merged = [...next.merged.filter((e) => e.summary.meta.pr?.number !== pr?.number), { summary, report: dir }].sort(
    byMerge,
  );
  return { site: next, reportDir: dir };
}

/** Drops rows for branches that have been deleted. `null` means the live list couldn't be read. */
export function pruneBranches(site: SiteData, liveBranches: string[] | null): SiteData {
  if (!liveBranches) return site;
  const live = new Set(liveBranches);
  return { ...site, branches: site.branches.filter((e) => live.has(e.summary.meta.branch)) };
}

/** Every report folder a row still links to. Anything else under reports/ can be deleted. */
export function referencedReports(site: SiteData): Set<string> {
  const all = [...site.main, ...site.branches, ...site.merged];
  return new Set(all.flatMap((e) => (e.report ? [e.report] : [])));
}
