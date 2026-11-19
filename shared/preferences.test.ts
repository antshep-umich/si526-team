import { describe, expect, it } from "vitest";
import { parseAssignmentMethod, parseChorePreferences } from "./preferences.js";

describe("parseChorePreferences", () => {
  it("keeps known chore types in list order without repeats", () => {
    expect(parseChorePreferences({ choreTypes: ["mopping", "dishes", "mopping"], weeklyWorkload: "heavy" })).toEqual({
      choreTypes: ["dishes", "mopping"],
      weeklyWorkload: "heavy",
    });
  });

  it("allows no chore types and no workload", () => {
    expect(parseChorePreferences({ choreTypes: [], weeklyWorkload: null })).toEqual({
      choreTypes: [],
      weeklyWorkload: null,
    });
  });

  it.each([
    ["not an object", "dishes"],
    ["choreTypes not a list", { choreTypes: "dishes", weeklyWorkload: null }],
    ["an unknown chore type", { choreTypes: ["juggling"], weeklyWorkload: null }],
    ["a missing workload", { choreTypes: [] }],
    ["an unknown workload", { choreTypes: [], weeklyWorkload: "max" }],
  ])("rejects %s", (_label, value) => {
    expect(parseChorePreferences(value)).toBeNull();
  });
});

describe("parseAssignmentMethod", () => {
  it("accepts the three methods and nothing else", () => {
    expect(parseAssignmentMethod("rotate")).toBe("rotate");
    expect(parseAssignmentMethod("preferences")).toBe("preferences");
    expect(parseAssignmentMethod("manager")).toBe("manager");
    expect(parseAssignmentMethod("Rotate")).toBeNull();
    expect(parseAssignmentMethod(undefined)).toBeNull();
  });
});
