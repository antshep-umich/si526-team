// Data shared by the test report scripts: AC files, test results, run summaries
// and the dashboard's history. See TECH_SPEC section 15.

/** How an acceptance criterion is shown to be met. */
export type Verify = "test" | "manual";

export interface Criterion {
  /** `AC1`, `AC2`, ... as numbered in the Jira story. */
  id: string;
  /** The criterion as written in Jira. */
  text: string;
  verify: Verify;
  /** Why a manual criterion can't be tested, or how it's demonstrated. */
  note?: string;
}

/** One Jira story's acceptance criteria, from `acceptance/<KEY>.json`. */
export interface Story {
  /** Jira key, for example `SCRUM-18`. Also the Vitest tag for its tests. */
  story: string;
  title: string;
  criteria: Criterion[];
}

export type TestState = "passed" | "failed" | "skipped";

/** One test as the reporter saw it (`test-report/results.json`). */
export interface TestRecord {
  /** Path from the repo root. */
  file: string;
  name: string;
  /** Suite names and the test name, joined with " > ". */
  fullName: string;
  /** Includes tags inherited from `describe` blocks. */
  tags: string[];
  state: TestState;
  durationMs: number;
}

export interface TestResults {
  startedAt: string;
  durationMs: number;
  /** Vitest's verdict: `failed` also covers files that failed to load. */
  reason: "passed" | "failed" | "interrupted";
  /** Errors Vitest couldn't attribute to a test. */
  unhandledErrors: number;
  tests: TestRecord[];
}

/** Where a run came from, which decides where the dashboard files it. */
export type RunKind = "main" | "branch" | "merged" | "pull-request" | "local";

export interface PullRequestInfo {
  number: number;
  title: string;
  mergeSha: string | null;
  mergedAt: string | null;
}

export interface RunMeta {
  kind: RunKind;
  /** `<GitHub run id>-<attempt>`, or `local-<timestamp>`. */
  runId: string;
  runUrl: string | null;
  repoUrl: string | null;
  branch: string;
  /** The commit that was tested. For a merged PR, the branch's final commit. */
  sha: string;
  /** First line of the commit message, or the PR title for a merged PR. */
  message: string;
  pr: PullRequestInfo | null;
}

export type AcStatus = "passing" | "failing" | "untested" | "manual";

export interface CriterionCoverage extends Criterion {
  status: AcStatus;
  tests: { name: string; state: TestState }[];
}

export interface StoryCoverage {
  story: string;
  title: string;
  criteria: CriterionCoverage[];
}

export interface Totals {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

/** Everything the dashboard keeps about one run (`test-report/summary.json`). */
export interface RunSummary {
  meta: RunMeta;
  startedAt: string;
  durationMs: number;
  outcome: "passed" | "failed";
  totals: Totals;
  stories: StoryCoverage[];
  /** Mistakes in AC files or tags. Any problem fails the CI run. */
  problems: string[];
}
