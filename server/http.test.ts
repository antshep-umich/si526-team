import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleError } from "./http.js";

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
});
