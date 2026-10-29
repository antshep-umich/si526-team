import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, sep } from "node:path";
import type { Reporter, SerializedError, TestModule, TestRunEndReason, Vitest } from "vitest/node";
import type { TestRecord, TestResults } from "./types.ts";

/**
 * Writes every test's name, tags and result to a JSON file for summarize.ts.
 * Vitest's own JSON reporter doesn't include tags, which is how tests are
 * linked to Jira stories. Enabled by `vitest run --mode report`.
 */
export default class TestResultsReporter implements Reporter {
  private readonly outputFile: string;
  private root = process.cwd();
  private startedAt = new Date();

  constructor(options: { outputFile: string }) {
    this.outputFile = options.outputFile;
  }

  onInit(vitest: Vitest) {
    this.root = vitest.config.root;
  }

  onTestRunStart() {
    this.startedAt = new Date();
  }

  onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<SerializedError>,
    reason: TestRunEndReason,
  ) {
    const tests: TestRecord[] = [];
    for (const testModule of testModules) {
      for (const test of testModule.children.allTests()) {
        const { state } = test.result();
        tests.push({
          // Vitest's own ids, which its HTML report uses in links (#/?file=…&test=…).
          id: test.id,
          moduleId: test.module.id,
          // Forward slashes on every OS (the team develops on Windows too).
          file: relative(this.root, test.module.moduleId).split(sep).join("/"),
          name: test.name,
          fullName: test.fullName,
          tags: [...test.tags],
          // "pending" only happens when a run is cut short, so the test never ran.
          state: state === "pending" ? "skipped" : state,
          durationMs: Math.round(test.diagnostic()?.duration ?? 0),
        });
      }
    }

    const results: TestResults = {
      startedAt: this.startedAt.toISOString(),
      durationMs: Date.now() - this.startedAt.getTime(),
      reason,
      unhandledErrors: unhandledErrors.length,
      tests,
    };
    mkdirSync(dirname(this.outputFile), { recursive: true });
    writeFileSync(this.outputFile, `${JSON.stringify(results, null, 2)}\n`);
  }
}
