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
