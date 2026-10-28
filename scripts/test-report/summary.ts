import { isStoryKey } from "./acceptance.ts";
import type {
  AcStatus,
  CriterionCoverage,
  RunMeta,
  RunSummary,
  Story,
  StoryCoverage,
  TestRecord,
  TestResults,
  Totals,
} from "./types.ts";

const AC_PREFIX = /^(AC\d+(?:\s*,\s*AC\d+)*)\s*:/;

/** The AC ids a test name starts with: `"AC1, AC3: ..."` gives `["AC1", "AC3"]`. */
export function parseAcIds(testName: string): string[] {
  const match = AC_PREFIX.exec(testName);
  return match ? match[1].split(",").map((id) => id.trim()) : [];
}

function statusOf(criterion: CriterionCoverage): AcStatus {
  // Skipped tests prove nothing, so they don't count either way.
  const ran = criterion.tests.filter((t) => t.state !== "skipped");
  if (ran.some((t) => t.state === "failed")) return "failing";
  if (ran.length > 0) return "passing";
  return criterion.verify === "manual" ? "manual" : "untested";
}

/** Joins test results with the AC files, and reports tagging mistakes. */
export function buildCoverage(tests: TestRecord[], stories: Story[]): { stories: StoryCoverage[]; problems: string[] } {
  const coverage: StoryCoverage[] = stories.map((s) => ({
    story: s.story,
    title: s.title,
    criteria: s.criteria.map((c) => ({ ...c, status: "untested", tests: [] })),
  }));
  const byKey = new Map(coverage.map((s) => [s.story, s]));
  const problems: string[] = [];

  for (const test of tests) {
    const where = `${test.file}: "${test.fullName}"`;
    const storyTags = test.tags.filter(isStoryKey);
    for (const tag of storyTags) {
      if (!byKey.has(tag)) problems.push(`${where} is tagged ${tag}, but acceptance/${tag}.json doesn't exist`);
    }

    const ids = parseAcIds(test.name);
    if (ids.length === 0) continue;
    if (storyTags.length === 0) {
      problems.push(`${where} names ${ids.join(", ")} but has no story tag`);
      continue;
    }
    if (storyTags.length > 1) {
      problems.push(`${where} names ${ids.join(", ")} but has several story tags (${storyTags.join(", ")}); use one`);
      continue;
    }
    const story = byKey.get(storyTags[0]);
    if (!story) continue;
    for (const id of ids) {
      const criterion = story.criteria.find((c) => c.id === id);
      if (!criterion) {
        problems.push(`${where} names ${id}, which isn't in acceptance/${story.story}.json`);
        continue;
      }
      criterion.tests.push({ name: test.fullName, state: test.state });
    }
  }

  for (const story of coverage) {
    for (const criterion of story.criteria) criterion.status = statusOf(criterion);
  }
  return { stories: coverage, problems };
}

function countTotals(tests: TestRecord[]): Totals {
  const count = (state: TestRecord["state"]) => tests.filter((t) => t.state === state).length;
  return { total: tests.length, passed: count("passed"), failed: count("failed"), skipped: count("skipped") };
}

/** Everything the dashboard records about one run. */
export function buildRunSummary(results: TestResults, stories: Story[], storyProblems: string[], meta: RunMeta): RunSummary {
  const totals = countTotals(results.tests);
  const coverage = buildCoverage(results.tests, stories);
  const failed = results.reason !== "passed" || totals.failed > 0 || results.unhandledErrors > 0;
  return {
    meta,
    startedAt: results.startedAt,
    durationMs: results.durationMs,
    outcome: failed ? "failed" : "passed",
    totals,
    stories: coverage.stories,
    problems: [...storyProblems, ...coverage.problems],
  };
}

function firstLine(text: string | undefined): string {
  return (text ?? "").split("\n")[0].trim();
}

/**
 * Works out where a run came from. In GitHub Actions this reads the standard
 * GITHUB_* variables plus the ones the Tests workflow sets (COMMIT_MESSAGE and
 * PR_*). Outside Actions it's a local run, described by LOCAL_BRANCH and LOCAL_SHA.
 */
export function runMetaFromEnv(env: Record<string, string | undefined>, now: string): RunMeta {
  if (env.GITHUB_ACTIONS !== "true") {
    return {
      kind: "local",
      runId: `local-${Date.parse(now)}`,
      runUrl: null,
      repoUrl: null,
      branch: env.LOCAL_BRANCH ?? "local",
      sha: env.LOCAL_SHA ?? "",
      message: firstLine(env.COMMIT_MESSAGE),
      pr: null,
    };
  }

  const repoUrl = `${env.GITHUB_SERVER_URL ?? "https://github.com"}/${env.GITHUB_REPOSITORY ?? ""}`;
  const common = {
    runId: `${env.GITHUB_RUN_ID ?? "0"}-${env.GITHUB_RUN_ATTEMPT ?? "1"}`,
    runUrl: `${repoUrl}/actions/runs/${env.GITHUB_RUN_ID ?? "0"}`,
    repoUrl,
  };

  if (env.GITHUB_EVENT_NAME === "pull_request") {
    const title = firstLine(env.PR_TITLE);
    return {
      ...common,
      kind: env.PR_MERGED === "true" ? "merged" : "pull-request",
      branch: env.PR_HEAD_REF ?? "",
      sha: env.PR_HEAD_SHA || (env.GITHUB_SHA ?? ""),
      message: title,
      pr: {
        number: Number(env.PR_NUMBER),
        title,
        mergeSha: env.PR_MERGE_SHA || null,
        mergedAt: env.PR_MERGED_AT || null,
      },
    };
  }

  const branch = env.GITHUB_REF_NAME ?? "";
  return {
    ...common,
    kind: branch === "main" ? "main" : "branch",
    branch,
    sha: env.GITHUB_SHA ?? "",
    message: firstLine(env.COMMIT_MESSAGE),
    pr: null,
  };
}
