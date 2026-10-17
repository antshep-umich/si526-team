import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Three test projects (README "Tests"):
//   server  API, services, middleware and shared helpers, in Node
//   web     React components, screens and API helpers, in jsdom
//   e2e     the real app in a real browser (Playwright), against a running server
// `npm test` runs server + web; `npm run test:e2e` runs e2e.
export default defineConfig({
  test: {
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
