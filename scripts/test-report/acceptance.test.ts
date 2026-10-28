import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadStories, parseStory } from "./acceptance.ts";

const validStory = {
  story: "SCRUM-18",
  title: "Create Household screen",
  criteria: [
    { id: "AC1", text: "A user can create a household by entering a name", verify: "test" },
    { id: "AC2", text: "The form matches the design", verify: "manual", note: "Shown in the UI demo" },
  ],
};

describe("parseStory", () => {
  it("accepts a valid story and keeps each criterion's note", () => {
    const { story, problems } = parseStory("SCRUM-18.json", validStory);

    expect(problems).toEqual([]);
    expect(story).toEqual(validStory);
  });

  it("keeps the story's epic when it has one", () => {
    const { story, problems } = parseStory("SCRUM-18.json", {
      ...validStory,
      epic: { key: "SCRUM-1", title: "Accounts and households" },
    });

    expect(problems).toEqual([]);
    expect(story?.epic).toEqual({ key: "SCRUM-1", title: "Accounts and households" });
  });

  it("requires the file name to match the story key", () => {
    const { story, problems } = parseStory("SCRUM-18.json", { ...validStory, story: "SCRUM-19" });

    expect(story).toBeNull();
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/SCRUM-18\.json/);
    expect(problems[0]).toMatch(/SCRUM-19/);
  });

  const invalid: [string, unknown, string, RegExp][] = [
    ["a key that isn't a Jira key", { ...validStory, story: "scrum18" }, "scrum18.json", /key/i],
    ["a missing title", { ...validStory, title: "" }, "SCRUM-18.json", /title/i],
    ["no criteria", { ...validStory, criteria: [] }, "SCRUM-18.json", /criteri/i],
    [
      "a duplicate AC id",
      { ...validStory, criteria: [validStory.criteria[0], { ...validStory.criteria[1], id: "AC1" }] },
      "SCRUM-18.json",
      /AC1/,
    ],
    [
      "an id not shaped AC<n>",
      { ...validStory, criteria: [{ ...validStory.criteria[0], id: "A1" }] },
      "SCRUM-18.json",
      /A1/,
    ],
    [
      "empty AC text",
      { ...validStory, criteria: [{ ...validStory.criteria[0], text: "  " }] },
      "SCRUM-18.json",
      /text/i,
    ],
    [
      "an unknown verify value",
      { ...validStory, criteria: [{ ...validStory.criteria[0], verify: "auto" }] },
      "SCRUM-18.json",
      /verify/i,
    ],
    ["something that isn't an object", ["SCRUM-18"], "SCRUM-18.json", /object/i],
    ["an epic without a title", { ...validStory, epic: { key: "SCRUM-1" } }, "SCRUM-18.json", /epic/i],
    ["an epic whose key isn't a Jira key", { ...validStory, epic: { key: "accounts", title: "Accounts" } }, "SCRUM-18.json", /epic/i],
    ["an epic that's just text", { ...validStory, epic: "SCRUM-1" }, "SCRUM-18.json", /epic/i],
  ];

  it.each(invalid)("rejects %s, naming the file", (_label, raw, fileName, detail) => {
    const { story, problems } = parseStory(fileName, raw);

    expect(story).toBeNull();
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(fileName);
    expect(problems.join("\n")).toMatch(detail);
  });
});

describe("loadStories", () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function makeDir(files: Record<string, string>): string {
    dir = mkdtempSync(join(tmpdir(), "acceptance-"));
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
    return dir;
  }

  it("loads the valid stories sorted by key and reports the broken ones", () => {
    makeDir({
      "SCRUM-20.json": JSON.stringify({ ...validStory, story: "SCRUM-20" }),
      "SCRUM-18.json": JSON.stringify(validStory),
      "SCRUM-21.json": "{ not json",
      "README.md": "# not a story",
    });

    const { stories, problems } = loadStories(dir);

    expect(stories.map((s) => s.story)).toEqual(["SCRUM-18", "SCRUM-20"]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/SCRUM-21\.json/);
  });

  it("returns nothing when the directory doesn't exist", () => {
    dir = mkdtempSync(join(tmpdir(), "acceptance-"));

    expect(loadStories(join(dir, "missing"))).toEqual({ stories: [], problems: [] });
  });

  it("ignores subdirectories", () => {
    makeDir({ "SCRUM-18.json": JSON.stringify(validStory) });
    mkdirSync(join(dir, "drafts.json"));

    expect(loadStories(dir).stories).toHaveLength(1);
  });
});
