import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "../services/errors.js";
import { handleError, notFound } from "./errors.js";

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
    ["VALIDATION_ERROR", 422],
    ["PASSWORD_INVALID", 422],
    ["DUE_DATE_IN_PAST", 422],
    ["ASSIGNEE_NOT_IN_HOUSEHOLD", 422],
    ["NOT_ASSIGNEE", 403],
    ["CHORE_NOT_FOUND", 404],
    ["INVITE_CODE_NOT_FOUND", 422],
    ["ACCOUNT_NOT_FOUND", 422],
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

  it("answers requests that match no route with a JSON 404 naming the route", async () => {
    const app = express();
    app.use(notFound);

    const res = await request(app).post("/api/nothing-here?token=abc");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
