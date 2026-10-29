# Test Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the tests on every push and on pull requests into `main`, and publish a GitHub Pages site with the latest result, history, per-branch status, an archive of each branch's final push before merge, and acceptance criteria (AC) coverage per Jira story.

**Architecture:** A custom Vitest reporter writes the test results (including tags) as JSON. A summary script joins the results with per-story AC files in `acceptance/` and produces one `summary.json` per run. A publish script applies that summary to the site's data file (`data/history.json`), copies in Vitest's single-file HTML report, renders a static `index.html`, and pushes the site to the `gh-pages` branch as a single commit, retrying when another run published first. All scripts are TypeScript that Node 24 runs directly (type stripping), so the publish job doesn't need `npm ci`.

**Tech Stack:** Node 24 (type stripping), TypeScript ~6.0, Vitest 5 (tags, custom reporter, HTML reporter with `singleFile`), `@vitest/ui`, GitHub Actions (checkout v7, setup-node v7, upload-artifact v7, download-artifact v8), GitHub Pages deployed from a branch.

**Spec:** The design agreed in conversation on 2026-10-23, recorded in `TECH_SPEC.md` section 15 by Task 8.

## Global Constraints

- Story tags are Jira keys (`SCRUM-18`). Every tag must be declared in the Vitest config; declarations come from `acceptance/*.json`, so an unknown story tag fails the run.
- AC tests are named `ACn: <behavior>` (or `AC1, AC3: ...`) and carry exactly one story tag. Only AC tests use the prefix.
- Tests are written from the AC text, never fitted to the code. A failing AC test is reported, not adjusted.
- No Jira integration. AC text lives in `acceptance/<KEY>.json`.
- Scripts in `scripts/test-report/` import each other with `.ts` extensions and use only erasable TypeScript syntax (`tsconfig.node.json` already sets `allowImportingTsExtensions` and `erasableSyntaxOnly`).
- The publish job uses only Node built-ins and `git`; no `npm ci`.
- Untrusted text (test names, AC text, branch names, commit messages, PR titles) never goes into a workflow `run:` script through `${{ }}`; it's passed through `env:`.
- The `gh-pages` branch is written only by the workflow, always as a single commit with no parent.
- Keep full reports for the last 30 `main` runs, the latest run of each live branch, and every merged PR. `history.json` rows are kept forever.
- Branches: the team pushes to its own dev branches with no prefixes and opens PRs only into `main`.

## Review Focus

1. **Untrusted text containing HTML or quotes** (a test named `<img onerror=...>`, a branch called `a"b`): the page shows it as text and nothing executes. Pinned by Task 4's escaping test.
2. **Two runs publishing at the same moment:** neither update is lost, and an older run for a branch never replaces a newer one. Pinned by Task 3's out-of-order test and Task 6's stale-lease test.
3. **A red or crashed test run:** a failing run with results is still recorded as failed and the job fails. A run that produced no results (for example, `npm ci` failed) publishes nothing. Pinned by Task 2's outcome tests and the workflow conditions in Task 7.
4. **An unreadable `history.json`:** publishing stops with an error and never replaces the history with an empty site. Pinned by Task 3's `parseSite` test and Task 5's test.
5. **Branch names with `/`, spaces or other symbols:** each branch gets a safe, distinct report path. Pinned by Task 3's slug test.

---

## File Structure

| File | Responsibility |
|---|---|
| `acceptance/README.md` | How AC files and AC test names work, for teammates |
| `acceptance/<KEY>.json` | One Jira story: key, title, ACs (none yet; added when stories arrive) |
| `vitest.config.ts` | Extends `vite.config.ts`: declares story tags, excludes `.claude/**`, adds the report reporters in `--mode report` |
| `scripts/test-report/types.ts` | Shared data types: stories, test results, run summaries, site data |
| `scripts/test-report/acceptance.ts` | Parse and load `acceptance/*.json` |
| `scripts/test-report/reporter.ts` | Vitest reporter that writes `test-report/results.json` |
| `scripts/test-report/summary.ts` | AC ids from test names, AC coverage, totals, run metadata from the environment |
| `scripts/test-report/summarize.ts` | CLI: results + AC files + environment → `test-report/summary.json` |
| `scripts/test-report/site.ts` | Site data: apply a run, prune deleted branches, retention, report paths |
| `scripts/test-report/render.ts` | Render `index.html` from the site data |
| `scripts/test-report/site-files.ts` | Apply a run to a site directory on disk: data, report, page, fonts, cleanup |
| `scripts/test-report/pages-git.ts` | Read the `gh-pages` branch, commit the site with no parent, push with a lease, retry |
| `scripts/test-report/publish.ts` | CLI used by the workflow |
| `scripts/test-report/preview.ts` | CLI: build a local site in `test-report/site` |
| `.github/workflows/tests.yml` | Runs the tests and publishes |
| `tsconfig.node.json` | Include `scripts` and `vitest.config.ts` in the type check |
| `package.json` | `@vitest/ui`; `test:ui` and `test:report` scripts |
| `.gitignore` | `test-report/`, `.vitest/` |
| `TECH_SPEC.md`, `README.md` | Conventions, setup steps, branch workflow |

## Data Types (`scripts/test-report/types.ts`)

```ts
export type Verify = "test" | "manual";
export interface Criterion { id: string; text: string; verify: Verify; note?: string }
export interface Story { story: string; title: string; criteria: Criterion[] }

export type TestState = "passed" | "failed" | "skipped";
export interface TestRecord { file: string; name: string; fullName: string; tags: string[]; state: TestState; durationMs: number }
export interface TestResults {
  startedAt: string;
  durationMs: number;
  reason: "passed" | "failed" | "interrupted";
  unhandledErrors: number;
  tests: TestRecord[];
}

export type RunKind = "main" | "branch" | "merged" | "pull-request" | "local";
export interface PullRequestInfo { number: number; title: string; mergeSha: string | null; mergedAt: string | null }
export interface RunMeta {
  kind: RunKind;
  runId: string;
  runUrl: string | null;
  repoUrl: string | null;
  branch: string;
  sha: string;
  message: string;
  pr: PullRequestInfo | null;
}

export type AcStatus = "passing" | "failing" | "untested" | "manual";
export interface CriterionCoverage extends Criterion { status: AcStatus; tests: { name: string; state: TestState }[] }
export interface StoryCoverage { story: string; title: string; criteria: CriterionCoverage[] }
export interface Totals { total: number; passed: number; failed: number; skipped: number }
export interface RunSummary {
  meta: RunMeta;
  startedAt: string;
  durationMs: number;
  outcome: "passed" | "failed";
  totals: Totals;
  stories: StoryCoverage[];
  problems: string[];
}

export interface SiteEntry { summary: RunSummary; report: string | null }
export interface SiteData { version: 1; updatedAt: string; main: SiteEntry[]; branches: SiteEntry[]; merged: SiteEntry[] }
```

---

### Task 1: AC files and story tags

**Files:** Create `scripts/test-report/types.ts`, `scripts/test-report/acceptance.ts`, `scripts/test-report/acceptance.test.ts`, `vitest.config.ts`, `acceptance/README.md`. Modify `tsconfig.node.json`.

**Interfaces:**
- Produces: `parseStory(fileName: string, raw: unknown): { story: Story | null; problems: string[] }` and `loadStories(dir: string): { stories: Story[]; problems: string[] }`. A missing directory gives `{ stories: [], problems: [] }`. Stories are sorted by key.

- [ ] Write failing tests in `acceptance.test.ts`:
  - a valid file parses, keeping `note` when present
  - the file name must match the key (`SCRUM-18.json` holding `"SCRUM-19"` is a problem)
  - a key that isn't Jira-shaped, a missing title, an empty `criteria`, a duplicate AC id, an id not shaped `AC<n>`, empty text, and a `verify` value other than `test` or `manual` each give a problem naming the file
  - `loadStories` reads only `*.json`, reports invalid JSON as a problem, and still returns the valid stories
  - `loadStories` on a missing directory returns empty lists
- [ ] Run `npx vitest run scripts/test-report/acceptance.test.ts` and confirm it fails because the module is missing.
- [ ] Implement `types.ts` (story types) and `acceptance.ts`.
- [ ] Run the tests and confirm they pass.
- [ ] Add `vitest.config.ts`: `mergeConfig(viteConfig, ...)`, `exclude: [...configDefaults.exclude, ".claude/**"]`, `tags` from `loadStories("acceptance")` (`description` set to the story title). Add `scripts` and `vitest.config.ts` to `tsconfig.node.json`'s `include`. Write `acceptance/README.md`.
- [ ] Check that a temporary `acceptance/SCRUM-1.json` shows up in `npx vitest --list-tags` and that a test tagged `SCRUM-2` fails with an unknown-tag error, then delete both. Run `npm test` and `npm run typecheck`.
- [ ] Commit.

### Task 2: Reporter, summary and `test:report`

**Files:** Create `scripts/test-report/reporter.ts`, `summary.ts`, `summary.test.ts`, `summarize.ts`. Modify `types.ts`, `vitest.config.ts`, `package.json`, `.gitignore`.

**Interfaces:**
- Consumes: `loadStories`, `Story`.
- Produces: `parseAcIds(testName: string): string[]`, `isStoryKey(tag: string): boolean`, `buildCoverage(tests: TestRecord[], stories: Story[]): { stories: StoryCoverage[]; problems: string[] }`, `buildRunSummary(results: TestResults, stories: Story[], storyProblems: string[], meta: RunMeta): RunSummary`, `runMetaFromEnv(env: Record<string, string | undefined>, now: string): RunMeta`.
- The reporter writes `test-report/results.json` (`TestResults`). The HTML reporter writes `test-report/html/index.html`. `summarize.ts` writes `test-report/summary.json` and exits 1 when `problems` is non-empty.

- [ ] Write failing tests in `summary.test.ts`:
  - `parseAcIds`: `"AC2: x"` → `["AC2"]`; `"AC1, AC3: x"` → `["AC1","AC3"]`; `"handles AC2: x"` and `"ac2: x"` → `[]`
  - coverage: an AC with one passing test is `passing`; any failing test makes it `failing`; no tests (or only skipped ones) makes it `untested`; a `manual` AC with no tests is `manual`; a `manual` AC that has tests takes its status from them
  - problems: an AC prefix with no story tag; an AC prefix with two story tags; an AC id that isn't in the story; a story tag with no AC file. Non-story tags (`slow`) are ignored
  - outcome is `failed` when any test failed, when `reason` isn't `passed`, or when there are unhandled errors, and `passed` otherwise; skipped tests count only toward `skipped`
  - `runMetaFromEnv`: a push to `main` gives `main`; a push to another branch gives `branch` with that branch's name; a merged PR gives `merged` with the PR's head branch, head SHA, title, merge SHA and merge time; an open PR gives `pull-request`; no `GITHUB_ACTIONS` gives `local`. Only the first line of the commit message is kept, and `runId` is `<run id>-<attempt>`
- [ ] Confirm the tests fail, implement `summary.ts`, and confirm they pass.
- [ ] Write `reporter.ts` (a class whose constructor takes `{ outputFile }`, records the start in `onTestRunStart`, and writes JSON in `onTestRunEnd` using `testCase.tags`, `testCase.result().state` and `testCase.diagnostic()?.duration`). Write `summarize.ts`.
- [ ] In `vitest.config.ts`, when `mode === "report"`, use the reporters `default`, `["html", { outputDir: "test-report/html", singleFile: true }]` and `["./scripts/test-report/reporter.ts", { outputFile: "test-report/results.json" }]`.
- [ ] `npm i -D @vitest/ui@<installed vitest version>`. Add the scripts `"test:ui": "vitest --ui"` and `"test:report": "vitest run --mode report && node scripts/test-report/summarize.ts && node scripts/test-report/preview.ts"` (preview arrives in Task 5; until then, run the first two parts by hand). Add `test-report/` and `.vitest/` to `.gitignore`.
- [ ] Run `npx vitest run --mode report` then `node scripts/test-report/summarize.ts`, and check that `results.json` lists every test with its tags and that `summary.json` totals match Vitest's output.
- [ ] Commit.

### Task 3: Site data

**Files:** Create `scripts/test-report/site.ts`, `site.test.ts`.

**Interfaces:**
- Produces: `MAIN_REPORTS_KEPT = 30`, `emptySite(now: string): SiteData`, `parseSite(text: string): SiteData` (throws on anything that isn't a version-1 site), `branchSlug(branch: string): string`, `applyRun(site: SiteData, summary: RunSummary, now: string): { site: SiteData; reportDir: string | null }` (`reportDir` is where to put this run's report, or `null` when the run was ignored), `pruneBranches(site: SiteData, liveBranches: string[] | null): SiteData`, `referencedReports(site: SiteData): Set<string>`.
- Report directories: `reports/main/<runId>`, `reports/branches/<slug>/<runId>`, `reports/merged/pr-<n>`.

- [ ] Write failing tests:
  - a `main` run goes first; the same `runId` again replaces its row instead of adding one; the 31st-newest row keeps its data but its `report` becomes `null`
  - a branch run replaces that branch's row; an older run (earlier `startedAt`) for the same branch is ignored and returns `reportDir: null`
  - a merged run is keyed by PR number (the same branch name merged twice gives two rows), newest merge first
  - `pull-request` and `local` runs throw
  - `pruneBranches` drops branches that aren't in the list and keeps everything when given `null`
  - `branchSlug("feature/a b")` contains only `[A-Za-z0-9._-]`, and `"a/b"` and `"a-b"` give different slugs
  - `parseSite` rejects invalid JSON, a missing `version`, or non-array sections
  - `referencedReports` returns every non-null report path
- [ ] Confirm they fail, implement, and confirm they pass. Commit.

### Task 4: Page rendering

**Files:** Create `scripts/test-report/render.ts`, `render.test.ts`.

**Interfaces:** Produces `renderSite(site: SiteData): string` (a complete HTML document) and `escapeHtml(text: string): string`.

Page order: latest `main` run; tests-per-run chart for `main` (stacked passed, failed and skipped, newest on the right, with an SVG `<title>` per bar); AC coverage by story from the latest `main` run; active branches; merged branches (with a link to the resulting `main` run when one has the merge SHA); `main` history. Every section has an empty state. Times are rendered in UTC inside `<time datetime>`, and a small inline script switches them to the viewer's local time. Libron is loaded from `assets/fonts/`. Light and dark themes.

- [ ] Load the frontend-design and dataviz skills before designing the page.
- [ ] Write failing tests:
  - a test name, AC text, branch name, commit message and PR title each containing `<script>`, `"` and `&` come out escaped
  - an empty site renders every section's empty state
  - the merged row links the `main` run whose SHA is the merge SHA, and has no link when there's no such run
  - a `main` row whose report was pruned shows "expired" instead of a link
  - AC statuses (`passing`, `failing`, `untested`, `manual`) render as labelled text, not color alone
- [ ] Confirm they fail, implement, and confirm they pass. Commit.

### Task 5: Site directory and local preview

**Files:** Create `scripts/test-report/site-files.ts`, `site-files.test.ts`, `preview.ts`.

**Interfaces:**
- Consumes: `parseSite`, `emptySite`, `applyRun`, `pruneBranches`, `referencedReports`, `renderSite`.
- Produces: `updateSiteDir(dir: string, inputs: { summary: RunSummary; reportHtml: string; liveBranches: string[] | null; fontsDir: string; now: string }): { accepted: boolean }`.

- [ ] Write failing tests using temporary directories:
  - an empty directory gets `data/history.json`, `index.html`, `.nojekyll`, the fonts plus `OFL.txt` under `assets/fonts/`, and the report at its `reportDir`
  - a second branch run for the same branch removes the first run's report directory
  - an invalid `history.json` throws, and the directory is unchanged afterwards
  - an ignored (older) branch run writes no report and returns `accepted: false`
- [ ] Confirm they fail, implement, and confirm they pass.
- [ ] Write `preview.ts`: builds `test-report/site` from `test-report/summary.json`, treating the run as a `main` run (or a branch run with `--as branch`), and prints the path to open.
- [ ] Run `npm run test:report` twice and open the page in a browser to check it (two runs in the chart, both themes, phone width). Then add a deliberately failing AC test in a scratch copy and check the red run renders, then remove it. Commit.

### Task 6: Publishing to `gh-pages`

**Files:** Create `scripts/test-report/pages-git.ts`, `pages-git.test.ts`, `publish.ts`.

**Interfaces:**
- Produces: `publishToBranch(opts: { repoDir: string; remote: string; branch: string; message: string; attempts?: number; build: (siteDir: string, liveBranches: string[]) => void }): { commit: string; attempts: number }`.

Each attempt: `git ls-remote --heads <remote>` (giving the live branches and the current `gh-pages` SHA); if `gh-pages` exists, fetch it and extract its files with `git archive` into a new temporary directory; call `build`; commit the directory with a temporary index (`GIT_INDEX_FILE`), `write-tree` and `commit-tree` with no parent; then `git push --force-with-lease=refs/heads/<branch>:<base or empty> <remote> <commit>:refs/heads/<branch>`. A rejected push retries from the start, up to `attempts` (default 5).

- [ ] Write failing tests against a temporary bare repository acting as the remote:
  - the first publish creates `gh-pages` with one commit and no parent
  - a second publish still leaves exactly one commit, and `build` received the first publish's files
  - `liveBranches` lists the remote's branches without `gh-pages`
  - stale lease: another publish lands between this attempt's read and push; the push is rejected, the retry rebuilds from the new state, and both updates survive
- [ ] Confirm they fail, implement, and confirm they pass.
- [ ] Write `publish.ts`: reads `test-report/summary.json`, refuses `local` and `pull-request` runs, and calls `publishToBranch` with `build` running `updateSiteDir` (fonts from `src/assets/fonts/libron`). Commit.

### Task 7: Workflow

**Files:** Create `.github/workflows/tests.yml`.

- [ ] Write the workflow:
  - Triggers: `push` to any branch except `gh-pages`, and `pull_request` into `main` (`opened`, `synchronize`, `reopened`, `closed`).
  - The `test` job is skipped for a PR closed without merging. For a merged PR, it checks out the PR's head SHA. It runs `npm ci`, then `npx vitest run --mode report` (with `continue-on-error`), then `summarize.ts` (with `continue-on-error`, PR and commit details passed through `env:`). It always uploads `test-report/` as an artifact and uploads the HTML report as one unzipped file. It sets the output `has-summary`. A last step fails the job if the tests or the summary failed.
  - The `publish` job (`contents: write`) runs after `test` when `has-summary` is `true` and the event is a push or a merged PR from this repository. It checks out the same commit, sets up Node 24, downloads the artifact, sets the bot's git identity, and runs `node scripts/test-report/publish.ts`.
- [ ] Check the YAML parses (`npx --yes yaml-lint` or a Node YAML parse), and read every `${{ }}` to confirm none puts untrusted text into a `run:` script. Commit.

### Task 8: Docs

**Files:** Modify `TECH_SPEC.md`, `README.md`.

- [ ] `TECH_SPEC.md`: add section 15 (testing, CI and the dashboard: the AC file format, tags and AC names, what runs when, what the site shows, retention, and one-time setup: enable Pages from `gh-pages`, then make the PR check required). Update section 2's testing row, section 3's repo layout, section 12's status table, and section 13 to describe the real branch workflow (dev branches, no prefixes, PRs only into `main`).
- [ ] `README.md`: add `npm run test:ui`, `npm run test:report` and the dashboard URL to the quick start.
- [ ] Commit.

## Not in this plan

- Enabling GitHub Pages and making the check required: both are repo settings the owner changes once the first publish has created `gh-pages`.
- AC files and tags for real stories: added as Anthony provides each story.
- React component test setup: added with the first story that has UI-behavior ACs.
