import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { bodyText } from "./body.js";

const withBody = (body: unknown) => ({ body }) as Request;

describe("bodyText", () => {
  it("returns a text field as-is (services do the trimming)", () => {
    expect(bodyText(withBody({ name: "  Maple St  " }), "name")).toBe("  Maple St  ");
  });

  it.each([
    ["a missing field", {}],
    ["a number", { name: 42 }],
    ["an array", { name: ["Maple"] }],
    ["null", { name: null }],
  ])("turns %s into an empty string", (_label, body) => {
    expect(bodyText(withBody(body), "name")).toBe("");
  });

  it("copes with no body at all", () => {
    expect(bodyText(withBody(undefined), "name")).toBe("");
  });
});
