import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";

const { findFirst, getPrisma } = vi.hoisted(() => {
  const findFirst = vi.fn();
  return { findFirst, getPrisma: vi.fn(() => ({ household: { findFirst } })) };
});
vi.mock("../db.js", () => ({ getPrisma }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/health", () => {
  it("reports ok when the database query succeeds, even with no households", async () => {
    findFirst.mockResolvedValueOnce(null);

    const res = await request(createApp()).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", database: "ok" });
    expect(findFirst).toHaveBeenCalledWith({ select: { id: true } });
  });

  it("answers 503 in the API error format when the database query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    findFirst.mockRejectedValueOnce(new Error('relation "Household" does not exist'));

    const res = await request(createApp()).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: { code: "DATABASE_UNAVAILABLE", message: "Database check failed" },
    });
  });

  it("answers 503 when the database is not configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getPrisma.mockImplementationOnce(() => {
      throw new Error("DATABASE_URL is not set");
    });

    const res = await request(createApp()).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("DATABASE_UNAVAILABLE");
  });
});
