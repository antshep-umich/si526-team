import { describe, expect, it } from "vitest";
import { describeAuthError, looksLikeEmail } from "./authErrors.ts";

const EMAIL_TAKEN = "An account with this email already exists. Use a different email or Log in instead.";
const PASSWORD_RULES = "Password must be at least 8 characters long and include 1 number.";

describe("describeAuthError", () => {
  it.each([
    [{ code: "USER_ALREADY_EXISTS", status: 422 }, "email", EMAIL_TAKEN],
    [{ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", status: 422 }, "email", EMAIL_TAKEN],
    [{ code: "INVALID_EMAIL", status: 400 }, "email", "Enter a valid email address."],
    [{ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }, "form", "Email or password is incorrect."],
    [{ code: "NAME_INVALID", status: 400 }, "name", "Name must be 30 characters or fewer."],
    [{ code: "PASSWORD_INVALID", status: 400 }, "password", PASSWORD_RULES],
    [{ code: "PASSWORD_TOO_SHORT", status: 400 }, "password", PASSWORD_RULES],
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

  it("calls anything else, a network failure included, a server error (SCRUM-2, SCRUM-3)", () => {
    const serverError = { field: "form", message: "Something went wrong. Please try again." };
    expect(describeAuthError({})).toEqual(serverError);
    expect(describeAuthError(null)).toEqual(serverError);
    expect(describeAuthError({ code: "SOMETHING_NEW", status: 500, message: "Server exploded" })).toEqual(serverError);
  });
});

describe("looksLikeEmail", () => {
  it.each([
    ["ana@example.com", true],
    [" ana@example.com ", true],
    ["ana@example", false],
    ["ana example.com", false],
    ["@example.com", false],
  ])("%s → %s", (value, ok) => {
    expect(looksLikeEmail(value)).toBe(ok);
  });
});
