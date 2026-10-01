import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("createApp", () => {
  it("answers unknown API routes with a JSON 404", async () => {
    const res = await request(createApp()).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({
      error: { code: "NOT_FOUND", message: "No route for GET /api/does-not-exist" },
    });
  });

  it("answers a malformed JSON body with a JSON 400", async () => {
    const res = await request(createApp())
      .post("/api/anything")
      .set("Content-Type", "application/json")
      .send('{"title": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: "INVALID_JSON", message: "Request body is not valid JSON" },
    });
  });
});
