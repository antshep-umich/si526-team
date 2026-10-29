import { describe, expect, it } from "vitest";
import { INVITE_CODE_LENGTH, newInviteCode } from "./inviteCode.js";

describe("newInviteCode", () => {
  it("makes 8-character codes", () => {
    expect(INVITE_CODE_LENGTH).toBe(8);
    expect(newInviteCode()).toHaveLength(8);
  });

  it("never uses characters that are easy to misread (0, O, 1, I, L)", () => {
    const codes = Array.from({ length: 500 }, newInviteCode).join("");

    expect(codes).toMatch(/^[A-HJKMNP-Z2-9]+$/);
  });

  it("doesn't repeat itself", () => {
    const codes = new Set(Array.from({ length: 500 }, newInviteCode));

    expect(codes.size).toBe(500);
  });
});
