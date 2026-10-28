import { describe, expect, it } from "vitest";
import { buildCoverage, buildRunSummary, parseAcIds, runMetaFromEnv } from "./summary.ts";
import type { RunMeta, Story, TestRecord, TestResults, TestState } from "./types.ts";

function testRecord(name: string, state: TestState, tags: string[] = []): TestRecord {
  return { file: "server/routes/households.test.ts", name, fullName: `POST /api/households > ${name}`, tags, state, durationMs: 3 };
}

const story: Story = {
  story: "SCRUM-18",
  title: "Create Household screen",
  criteria: [
    { id: "AC1", text: "Creates a household", verify: "test" },
    { id: "AC2", text: "Refuses a second household", verify: "test" },
    { id: "AC3", text: "Form matches the design", verify: "manual", note: "UI demo" },
  ],
};

function statuses(tests: TestRecord[], stories: Story[] = [story]) {
  const { stories: coverage } = buildCoverage(tests, stories);
  return Object.fromEntries(coverage[0].criteria.map((c) => [c.id, c.status]));
}

describe("parseAcIds", () => {
  it.each([
    ["AC2: refuses a second household", ["AC2"]],
    ["AC1, AC3: creates and shows it", ["AC1", "AC3"]],
    ["AC1,AC12: no spaces", ["AC1", "AC12"]],
    ["handles AC2: in the middle", []],
    ["ac2: lower case", []],
    ["AC2 without a colon", []],
  ])("%j → %j", (name, ids) => {
    expect(parseAcIds(name)).toEqual(ids);
  });
});

describe("buildCoverage", () => {
  it("marks an AC passing when its test passed", () => {
    expect(statuses([testRecord("AC1: creates", "passed", ["SCRUM-18"])]).AC1).toBe("passing");
  });

  it("marks an AC failing when any of its tests failed", () => {
    const tests = [
      testRecord("AC2: refuses", "passed", ["SCRUM-18"]),
      testRecord("AC2: refuses again", "failed", ["SCRUM-18"]),
    ];
    expect(statuses(tests).AC2).toBe("failing");
  });

  it("marks an AC untested when it has no tests or only skipped ones", () => {
    const result = statuses([testRecord("AC2: refuses", "skipped", ["SCRUM-18"])]);
    expect(result.AC1).toBe("untested");
    expect(result.AC2).toBe("untested");
  });

  it("marks a manual AC with no tests as manual", () => {
    expect(statuses([]).AC3).toBe("manual");
  });

  it("takes a manual AC's status from its tests when it has some", () => {
    expect(statuses([testRecord("AC3: matches", "failed", ["SCRUM-18"])]).AC3).toBe("failing");
  });

  it("lists each AC's tests with their state", () => {
    const { stories } = buildCoverage([testRecord("AC1, AC2: both", "passed", ["SCRUM-18"])], [story]);
    expect(stories[0].criteria[0].tests).toEqual([{ name: "POST /api/households > AC1, AC2: both", state: "passed" }]);
    expect(stories[0].criteria[1].tests).toHaveLength(1);
    expect(stories[0].criteria[0]).toMatchObject({ id: "AC1", text: "Creates a household", verify: "test" });
  });

  it("covers every story, including ones with no tests", () => {
    const other: Story = { story: "SCRUM-20", title: "Join", criteria: [{ id: "AC1", text: "Joins", verify: "test" }] };
    const { stories } = buildCoverage([], [story, other]);
    expect(stories.map((s) => s.story)).toEqual(["SCRUM-18", "SCRUM-20"]);
  });

  const mistakes: [string, TestRecord, RegExp][] = [
    ["an AC test with no story tag", testRecord("AC1: creates", "passed", ["slow"]), /no story tag/],
    ["an AC test with two story tags", testRecord("AC1: creates", "passed", ["SCRUM-18", "SCRUM-20"]), /SCRUM-20/],
    ["an AC id the story doesn't have", testRecord("AC9: creates", "passed", ["SCRUM-18"]), /AC9/],
    ["a story tag with no AC file", testRecord("supporting test", "passed", ["SCRUM-404"]), /SCRUM-404/],
  ];

  it.each(mistakes)("reports %s, naming the test", (_label, test, detail) => {
    const other: Story = { story: "SCRUM-20", title: "Join", criteria: [{ id: "AC1", text: "Joins", verify: "test" }] };
    const { problems } = buildCoverage([test], [story, other]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(test.fullName);
    expect(problems[0]).toMatch(detail);
  });

  it("ignores tags that aren't story keys and tests with no AC id", () => {
    const { problems } = buildCoverage(
      [testRecord("plain test", "passed", ["slow"]), testRecord("supporting test", "passed", ["SCRUM-18"])],
      [story],
    );
    expect(problems).toEqual([]);
  });
});

describe("buildRunSummary", () => {
  const meta: RunMeta = {
    kind: "main",
    runId: "1-1",
    runUrl: null,
    repoUrl: null,
    branch: "main",
    sha: "abc",
    message: "",
    pr: null,
  };

  function results(overrides: Partial<TestResults>): TestResults {
    return { startedAt: "2026-10-28T15:00:00.000Z", durationMs: 412, reason: "passed", unhandledErrors: 0, tests: [], ...overrides };
  }

  it("counts passed, failed and skipped tests", () => {
    const tests = [testRecord("a", "passed"), testRecord("b", "passed"), testRecord("c", "skipped"), testRecord("d", "failed")];
    const summary = buildRunSummary(results({ tests, reason: "failed" }), [], [], meta);
    expect(summary.totals).toEqual({ total: 4, passed: 2, failed: 1, skipped: 1 });
    expect(summary.startedAt).toBe("2026-10-28T15:00:00.000Z");
    expect(summary.durationMs).toBe(412);
  });

  it("passes when every test passed or was skipped", () => {
    const tests = [testRecord("a", "passed"), testRecord("b", "skipped")];
    expect(buildRunSummary(results({ tests }), [], [], meta).outcome).toBe("passed");
  });

  it.each<[string, Partial<TestResults>]>([
    ["a test failed", { tests: [testRecord("a", "failed")] }],
    ["the run was interrupted", { reason: "interrupted" }],
    ["a test file failed to load", { reason: "failed" }],
    ["an error happened outside any test", { unhandledErrors: 1 }],
  ])("fails when %s", (_label, overrides) => {
    expect(buildRunSummary(results(overrides), [], [], meta).outcome).toBe("failed");
  });

  it("combines AC file problems with tagging problems", () => {
    const summary = buildRunSummary(
      results({ tests: [testRecord("AC1: creates", "passed")] }),
      [story],
      ["SCRUM-21.json: not valid JSON"],
      meta,
    );
    expect(summary.problems).toHaveLength(2);
    expect(summary.problems[0]).toBe("SCRUM-21.json: not valid JSON");
  });
});

describe("runMetaFromEnv", () => {
  const now = "2026-10-28T15:00:00.000Z";
  const actions = {
    GITHUB_ACTIONS: "true",
    GITHUB_SERVER_URL: "https://github.com",
    GITHUB_REPOSITORY: "antshep-umich/si526-team",
    GITHUB_RUN_ID: "123",
    GITHUB_RUN_ATTEMPT: "2",
    GITHUB_SHA: "1111111111111111111111111111111111111111",
  };

  it("treats a push to main as a main run", () => {
    const meta = runMetaFromEnv(
      { ...actions, GITHUB_EVENT_NAME: "push", GITHUB_REF_NAME: "main", COMMIT_MESSAGE: "Merge pull request #9\n\nAdd households" },
      now,
    );
    expect(meta).toEqual({
      kind: "main",
      runId: "123-2",
      runUrl: "https://github.com/antshep-umich/si526-team/actions/runs/123",
      repoUrl: "https://github.com/antshep-umich/si526-team",
      branch: "main",
      sha: "1111111111111111111111111111111111111111",
      message: "Merge pull request #9",
      pr: null,
    });
  });

  it("treats a push to any other branch as a branch run", () => {
    const meta = runMetaFromEnv({ ...actions, GITHUB_EVENT_NAME: "push", GITHUB_REF_NAME: "louise-dev", COMMIT_MESSAGE: "Fix" }, now);
    expect(meta.kind).toBe("branch");
    expect(meta.branch).toBe("louise-dev");
  });

  it("records a merged pull request's head branch, head commit and merge details", () => {
    const meta = runMetaFromEnv(
      {
        ...actions,
        GITHUB_EVENT_NAME: "pull_request",
        GITHUB_REF_NAME: "9/merge",
        PR_MERGED: "true",
        PR_NUMBER: "9",
        PR_TITLE: "Add households",
        PR_HEAD_REF: "louise-dev",
        PR_HEAD_SHA: "2222222222222222222222222222222222222222",
        PR_MERGE_SHA: "3333333333333333333333333333333333333333",
        PR_MERGED_AT: "2026-10-28T16:00:00Z",
      },
      now,
    );
    expect(meta).toMatchObject({
      kind: "merged",
      branch: "louise-dev",
      sha: "2222222222222222222222222222222222222222",
      message: "Add households",
      pr: {
        number: 9,
        title: "Add households",
        mergeSha: "3333333333333333333333333333333333333333",
        mergedAt: "2026-10-28T16:00:00Z",
      },
    });
  });

  it("treats an open pull request as a pull-request run", () => {
    const meta = runMetaFromEnv(
      { ...actions, GITHUB_EVENT_NAME: "pull_request", PR_MERGED: "false", PR_NUMBER: "9", PR_HEAD_REF: "louise-dev" },
      now,
    );
    expect(meta.kind).toBe("pull-request");
    expect(meta.pr).toMatchObject({ number: 9, mergeSha: null, mergedAt: null });
  });

  it("treats a run outside GitHub Actions as local", () => {
    const meta = runMetaFromEnv({ LOCAL_BRANCH: "test-dashboard", LOCAL_SHA: "abc" }, now);
    expect(meta).toMatchObject({ kind: "local", branch: "test-dashboard", sha: "abc", runUrl: null, repoUrl: null, pr: null });
    expect(meta.runId).toMatch(/^local-\d+$/);
  });
});
