// Keeps the server's layers honest (TECH_SPEC section 3): each layer may only use
// the layers below it. Fails with the file and import that break a rule.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SERVER = join(import.meta.dirname);

/** The source files (not tests) in a server folder. */
function sourceFiles(folder: string): string[] {
  return readdirSync(join(SERVER, folder))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(folder, f));
}

/** Every module a file imports, as written ("express", "../models/households.js", ...). */
function importsOf(file: string): string[] {
  const source = readFileSync(join(SERVER, file), "utf8");
  return [...source.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]!);
}

/** Imports in `folder` that match any forbidden pattern, as "file → import". */
function violations(folder: string, forbidden: RegExp[]): string[] {
  return sourceFiles(folder).flatMap((file) =>
    importsOf(file)
      .filter((spec) => forbidden.some((pattern) => pattern.test(spec)))
      .map((spec) => `${file} → ${spec}`),
  );
}

const EXPRESS = /^express$/;
const PRISMA = /^@prisma\/|generated\/prisma/;
const DB = /(^|\/)db\.js$/;
const MODELS = /\/models\//;
const SERVICES = /\/services\//;
const CONTROLLERS = /\/controllers\//;

describe("server layers", () => {
  it("routes only wire URLs and middleware to controllers", () => {
    expect(violations("routes", [SERVICES, MODELS, DB, PRISMA])).toEqual([]);
  });

  it("controllers never touch models or the database", () => {
    expect(violations("controllers", [MODELS, DB, PRISMA])).toEqual([]);
  });

  it("services never import Express, Prisma or the database client", () => {
    expect(violations("services", [EXPRESS, PRISMA, DB, CONTROLLERS])).toEqual([]);
  });

  it("models never import Express, services or controllers", () => {
    expect(violations("models", [EXPRESS, SERVICES, CONTROLLERS])).toEqual([]);
  });

  it("middleware uses services, not models or the database", () => {
    expect(violations("middleware", [MODELS, DB, PRISMA, CONTROLLERS])).toEqual([]);
  });

  it("can see imports (so an empty result above means something)", () => {
    expect(importsOf("routes/households.ts")).toContain("../controllers/households.js");
  });
});
