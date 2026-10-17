import { describe, expect, it } from "vitest";
import { describeAuthError, NETWORK_MESSAGE } from "./authErrors.ts";

describe("describeAuthError", () => {
  it.each([
    [{ code: "USER_ALREADY_EXISTS", status: 422 }, "email", "An account already uses this email. Log in instead."],
    [{ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", status: 422 }, "email", "An account already uses this email. Log in instead."],
    [{ code: "INVALID_EMAIL", status: 400 }, "email", "Enter a valid email address."],
    [{ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }, "password", "That email and password don't match."],
    [{ code: "PASSWORD_TOO_SHORT", status: 400 }, "password", "Use at least 8 characters."],
    [{ code: "PASSWORD_TOO_LONG", status: 400 }, "password", "That password is too long."],
  ])("puts %o on the %s field", (error, field, message) => {
    expect(describeAuthError(error)).toEqual({ field, message });
  });

  it("explains rate limiting", () => {
    expect(describeAuthError({ status: 429 })).toEqual({
      field: "form",
      message: "Too many tries. Wait a moment, then try again.",
    });
  });

  it("treats a missing status as a network failure", () => {
    expect(describeAuthError({})).toEqual({ field: "form", message: NETWORK_MESSAGE });
    expect(describeAuthError(null)).toEqual({ field: "form", message: NETWORK_MESSAGE });
  });

  it("falls back to Better Auth's own message for anything else", () => {
    expect(describeAuthError({ code: "SOMETHING_NEW", status: 500, message: "Server exploded" })).toEqual({
      field: "form",
      message: "Server exploded",
    });
  });
});
