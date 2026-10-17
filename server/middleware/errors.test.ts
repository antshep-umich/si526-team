import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "../services/errors.js";
import { handleError } from "./errors.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleError", () => {
  it("turns an unexpected error into a JSON 500 without leaking details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const app = express();
    app.get("/boom", () => {
      throw new Error("secret connection string in stack");
    });
    app.use(handleError);

    const res = await request(app).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });

  it.each([
    ["VALIDATION_ERROR", 400],
    ["FORBIDDEN", 403],
    ["NO_HOUSEHOLD", 404],
    ["ALREADY_IN_HOUSEHOLD", 409],
  ] as const)("answers a ServiceError %s with %i and its message", async (code, status) => {
    const app = express();
    app.get("/rule", () => {
      throw new ServiceError(code, "Message for the user");
    });
    app.use(handleError);

    const res = await request(app).get("/rule");

    expect(res.status).toBe(status);
    expect(res.body).toEqual({ error: { code, message: "Message for the user" } });
  });
});
