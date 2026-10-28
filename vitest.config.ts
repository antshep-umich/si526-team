import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { loadStories } from "./scripts/test-report/acceptance.ts";

// Every Jira story with an AC file becomes a tag, so a test tagged with a
// mistyped key fails instead of quietly missing the coverage report. Tags are
// shared by all projects. Broken AC files are reported by the test report
// summary (TECH_SPEC section 15).
const { stories } = loadStories("acceptance");

// Four test projects (README "Tests"):
//   server   API, services, middleware and shared helpers, in Node
//   web      React components, screens and API helpers, in jsdom
//   scripts  the test report and dashboard scripts, in Node
//   e2e      the real app in a real browser (Playwright), against a running server
// `npm test` runs server + web + scripts; `npm run test:e2e` runs e2e.
export default defineConfig({
  test: {
    tags: stories.map((s) => ({ name: s.story, description: s.title })),
    projects: [
      {
        test: {
          name: "server",
          environment: "node",
          include: ["server/**/*.test.ts", "shared/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "web",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          setupFiles: ["src/test/setup.ts"],
          // Keep CSS module class names readable ("primary", not a hash) so tests can check variants.
          css: { include: [/\.module\.css$/], modules: { classNameStrategy: "non-scoped" } },
          restoreMocks: true,
        },
      },
      {
        test: {
          name: "scripts",
          environment: "node",
          include: ["scripts/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "e2e",
          environment: "node",
          include: ["e2e/**/*.e2e.test.ts"],
          globalSetup: ["e2e/globalSetup.ts"],
          // One browser flow at a time: they share a database and, on Vercel, a sign-in rate limit.
          fileParallelism: false,
          testTimeout: 90_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
