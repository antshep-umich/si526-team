import { describe, expect, it } from "vitest";
import { apiError, HOUSEHOLD_NAME_MAX_LENGTH, normalizeInviteCode, parseHouseholdName } from "./api.js";

describe("apiError", () => {
  it("builds the API's error body", () => {
    expect(apiError("NOT_FOUND", "Nothing here")).toEqual({ error: { code: "NOT_FOUND", message: "Nothing here" } });
  });
});

describe("parseHouseholdName", () => {
  it("trims the name", () => {
    expect(parseHouseholdName("  Maple St House ")).toBe("Maple St House");
  });

  it(`accepts 1 to ${HOUSEHOLD_NAME_MAX_LENGTH} characters`, () => {
    expect(parseHouseholdName("A")).toBe("A");
    expect(parseHouseholdName("x".repeat(HOUSEHOLD_NAME_MAX_LENGTH))).toHaveLength(HOUSEHOLD_NAME_MAX_LENGTH);
  });

  it.each([
    ["empty", ""],
    ["only spaces", "   "],
    ["too long", "x".repeat(HOUSEHOLD_NAME_MAX_LENGTH + 1)],
    ["a number", 42],
    ["missing", undefined],
  ])("rejects a name that is %s", (_label, value) => {
    expect(parseHouseholdName(value)).toBeNull();
  });
});

describe("normalizeInviteCode", () => {
  it.each([
    ["ABCDEFGH", "ABCDEFGH"],
    ["abcdefgh", "ABCDEFGH"],
    ["abcd-efgh", "ABCDEFGH"],
    [" ab cd ef gh ", "ABCDEFGH"],
  ])("reads %j as %j", (typed, expected) => {
    expect(normalizeInviteCode(typed)).toBe(expected);
  });

  it.each([
    ["empty", ""],
    ["only spaces and hyphens", " - - "],
    ["longer than 32 characters", "A".repeat(33)],
    ["not text", ["ABCDEFGH"]],
  ])("rejects a code that is %s", (_label, value) => {
    expect(normalizeInviteCode(value)).toBeNull();
  });
});
