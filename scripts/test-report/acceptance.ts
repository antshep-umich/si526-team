import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Criterion, Story } from "./types.ts";

const STORY_KEY = /^[A-Z][A-Z0-9]*-\d+$/;
const AC_ID = /^AC\d+$/;
const VERIFY_VALUES = ["test", "manual"];

/** True for a Jira key like `SCRUM-18`, which is how story tags are spelled. */
export function isStoryKey(tag: string): boolean {
  return STORY_KEY.test(tag);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** Checks one AC file's contents. Returns the story only when it has no problems. */
export function parseStory(fileName: string, raw: unknown): { story: Story | null; problems: string[] } {
  const problems: string[] = [];
  const problem = (message: string) => problems.push(`${fileName}: ${message}`);

  if (!isObject(raw)) {
    problem("expected a JSON object with story, title and criteria");
    return { story: null, problems };
  }

  const key = raw.story;
  if (typeof key !== "string" || !isStoryKey(key)) {
    problem(`"story" must be a Jira key like SCRUM-18, got ${JSON.stringify(key)}`);
  } else if (fileName !== `${key}.json`) {
    problem(`file name must match its story key ${key} (expected ${key}.json)`);
  }
  if (!nonEmptyString(raw.title)) problem(`"title" is missing`);

  const criteria: Criterion[] = [];
  if (!Array.isArray(raw.criteria) || raw.criteria.length === 0) {
    problem(`"criteria" must list at least one acceptance criterion`);
  } else {
    const seen = new Set<string>();
    raw.criteria.forEach((item: unknown, index) => {
      const where = `criteria[${index}]`;
      if (!isObject(item)) {
        problem(`${where} must be an object`);
        return;
      }
      const { id, text, verify, note } = item;
      if (typeof id !== "string" || !AC_ID.test(id)) {
        problem(`${where} "id" must look like AC1, got ${JSON.stringify(id)}`);
      } else if (seen.has(id)) {
        problem(`${id} is listed more than once`);
      } else {
        seen.add(id);
      }
      if (!nonEmptyString(text)) problem(`${where} "text" is missing`);
      if (typeof verify !== "string" || !VERIFY_VALUES.includes(verify)) {
        problem(`${where} "verify" must be "test" or "manual", got ${JSON.stringify(verify)}`);
      }
      if (note !== undefined && typeof note !== "string") problem(`${where} "note" must be text`);

      const criterion: Criterion = { id: String(id), text: String(text), verify: verify as Criterion["verify"] };
      if (typeof note === "string") criterion.note = note;
      criteria.push(criterion);
    });
  }

  if (problems.length > 0) return { story: null, problems };
  return { story: { story: key as string, title: raw.title as string, criteria }, problems };
}

/** Reads every `*.json` file in `dir`. A missing directory means no stories yet. */
export function loadStories(dir: string): { stories: Story[]; problems: string[] } {
  if (!existsSync(dir)) return { stories: [], problems: [] };

  const stories: Story[] = [];
  const problems: string[] = [];
  const files = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith(".json"));
  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(dir, file.name), "utf8"));
    } catch (err) {
      problems.push(`${file.name}: not valid JSON (${(err as Error).message})`);
      continue;
    }
    const result = parseStory(file.name, raw);
    problems.push(...result.problems);
    if (result.story) stories.push(result.story);
  }
  stories.sort((a, b) => a.story.localeCompare(b.story, "en", { numeric: true }));
  return { stories, problems };
}
