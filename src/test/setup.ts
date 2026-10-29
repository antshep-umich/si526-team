// Runs before every web test: adds DOM matchers such as toBeInTheDocument and
// unmounts rendered components after each test.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
