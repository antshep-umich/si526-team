import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { requireJsonBody } from "./json.js";

const app = express();
app.use(express.json(), requireJsonBody);
app.post("/echo", (req, res) => {
  res.json({ body: req.body ?? null });
});

describe("requireJsonBody", () => {
  it("lets JSON bodies through", async () => {
    const res = await request(app).post("/echo").send({ name: "Maple" });

    expect(res.status).toBe(200);
    expect(res.body.body).toEqual({ name: "Maple" });
  });

  it("lets requests with no body through, including Content-Length: 0", async () => {
    const res = await request(app).post("/echo").set("Content-Length", "0");

    expect(res.status).toBe(200);
  });

  it.each([
    ["plain text", "text/plain", "name=Maple"],
    ["a form", "application/x-www-form-urlencoded", "name=Maple"],
    ["XML", "application/xml", "<name>Maple</name>"],
  ])("answers %s with 415", async (_label, type, body) => {
    const res = await request(app).post("/echo").set("Content-Type", type).send(body);

    expect(res.status).toBe(415);
    expect(res.body).toEqual({
      error: {
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Send the request body as JSON (Content-Type: application/json)",
      },
    });
  });

  it("accepts JSON with a charset", async () => {
    const res = await request(app).post("/echo").set("Content-Type", "application/json; charset=utf-8").send('{"a":1}');

    expect(res.status).toBe(200);
  });
});
