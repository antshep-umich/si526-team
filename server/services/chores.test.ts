// Chore rules (SCRUM-6, 7, 8), with in-memory models and a fixed clock.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../test/fakeModels.js";
import { addChore, completeChore, getChore, listChores, undoChore } from "./chores.js";
import { ServiceError } from "./errors.js";
import { createHousehold, findMembership, joinHousehold } from "./households.js";

vi.mock("../models/households.js", () => import("../test/fakeModels.js"));
vi.mock("../models/memberships.js", () => import("../test/fakeModels.js"));
vi.mock("../models/chores.js", () => import("../test/fakeModels.js"));

/** Runs `fn` and returns the ServiceError code it threw. */
async function codeOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof ServiceError) return err.code;
    throw err;
  }
  throw new Error("Expected a ServiceError");
}

const NOW = new Date("2026-10-29T15:00:00Z"); // a Thursday

/** Ana owns a household; Ben is a member; Cy is in another household. */
async function setUp() {
  const { inviteCode } = await createHousehold("ana", "Maple St House");
  await joinHousehold("ben", inviteCode);
  await createHousehold("cy", "Other House");
  return {
    ana: (await findMembership("ana"))!,
    ben: (await findMembership("ben"))!,
    cy: (await findMembership("cy"))!,
  };
}

const chore = (overrides: Partial<{ name: string; assigneeId: string; dueDate: string; notes: unknown }> = {}) => ({
  name: "Take out trash",
  assigneeId: "ana",
  dueDate: "2026-10-30",
  notes: undefined,
  ...overrides,
});

beforeEach(() => {
  db.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("addChore (SCRUM-6)", () => {
  it("adds a chore with a trimmed name and notes, created by the caller", async () => {
    const { ben } = await setUp();

    const added = await addChore(ben, chore({ name: "  Take out trash ", notes: "  Bins by the gate  " }));

    expect(added).toMatchObject({
      name: "Take out trash",
      notes: "Bins by the gate",
      assigneeId: "ana",
      createdById: "ben",
      householdId: ben.householdId,
      completedAt: null,
    });
    expect(added.dueDate.toISOString()).toBe("2026-10-30T00:00:00.000Z");
  });

  it("lets anyone assign a chore to themself", async () => {
    const { ana } = await setUp();

    expect((await addChore(ana, chore({ assigneeId: "ana" }))).assignee?.name).toBe("Ana Test");
  });

  it.each([
    ["an empty name", { name: "  " }, "VALIDATION_ERROR", "Chore name is required."],
    ["a 61-character name", { name: "x".repeat(61) }, "VALIDATION_ERROR", "Chore name must be 60 characters or fewer."],
    ["no assignee", { assigneeId: "" }, "VALIDATION_ERROR", "Choose who this chore is assigned to."],
    ["no due date", { dueDate: "" }, "VALIDATION_ERROR", "Choose a due date."],
    ["an impossible date", { dueDate: "2026-02-30" }, "VALIDATION_ERROR", "Choose a due date."],
    ["a past due date", { dueDate: "2026-10-27" }, "DUE_DATE_IN_PAST", "Due date can't be in the past."],
    ["201-character notes", { notes: "x".repeat(201) }, "VALIDATION_ERROR", "Notes must be 200 characters or fewer."],
    ["an assignee from another household", { assigneeId: "cy" }, "ASSIGNEE_NOT_IN_HOUSEHOLD", "That person isn't in your household."],
    ["an assignee with no household", { assigneeId: "nobody" }, "ASSIGNEE_NOT_IN_HOUSEHOLD", "That person isn't in your household."],
  ])("rejects %s", async (_label, overrides, code, message) => {
    const { ana } = await setUp();

    await expect(addChore(ana, chore(overrides))).rejects.toMatchObject({ code, message });
    expect(db.chores).toHaveLength(0);
  });

  it("accepts a due date of yesterday in UTC, which can still be today on a phone west of UTC", async () => {
    const { ana } = await setUp();

    await expect(addChore(ana, chore({ dueDate: "2026-10-28" }))).resolves.toBeDefined();
  });

  it("keeps blank notes as none", async () => {
    const { ana } = await setUp();

    expect((await addChore(ana, chore({ notes: "   " }))).notes).toBeNull();
  });
});

describe("listChores (SCRUM-7)", () => {
  it("returns only the caller's household's chores", async () => {
    const { ana, cy } = await setUp();
    await addChore(ana, chore({ name: "Ours" }));
    await addChore(cy, chore({ name: "Theirs", assigneeId: "cy" }));

    expect((await listChores(ana)).map((c) => c.name)).toEqual(["Ours"]);
  });

  it("includes chores not done whatever their date, and done chores since the date asked", async () => {
    const { ana } = await setUp();
    await addChore(ana, chore({ name: "Open", dueDate: "2026-10-29" }));
    const doneLongAgo = await addChore(ana, chore({ name: "Done long ago", dueDate: "2026-10-29" }));
    db.chores.find((c) => c.id === doneLongAgo.id)!.completedAt = new Date("2026-09-01T10:00:00Z");
    db.chores.find((c) => c.id === doneLongAgo.id)!.dueDate = new Date("2026-09-01T00:00:00Z");

    const names = (await listChores(ana, "2026-10-26")).map((c) => c.name);

    expect(names).toEqual(["Open"]);
  });

  it("rejects a since that isn't a date", async () => {
    const { ana } = await setUp();

    expect(await codeOf(() => listChores(ana, "last monday"))).toBe("VALIDATION_ERROR");
  });
});

describe("completeChore and undoChore (SCRUM-8)", () => {
  it("lets the assignee mark a chore done, saving when and who, and undo it", async () => {
    const { ana, ben } = await setUp();
    const added = await addChore(ben, chore({ assigneeId: "ana" }));

    const done = await completeChore(ana, added.id);
    expect(done.completedAt?.toISOString()).toBe(NOW.toISOString());
    expect(done.completedBy?.name).toBe("Ana Test");

    const undone = await undoChore(ana, added.id);
    expect(undone.completedAt).toBeNull();
    expect(undone.completedById).toBeNull();
  });

  it("refuses anyone but the assignee, even the person who added it", async () => {
    const { ana, ben } = await setUp();
    const added = await addChore(ben, chore({ assigneeId: "ana" }));

    expect(await codeOf(() => completeChore(ben, added.id))).toBe("NOT_ASSIGNEE");
    await completeChore(ana, added.id);
    expect(await codeOf(() => undoChore(ben, added.id))).toBe("NOT_ASSIGNEE");
  });

  it("is harmless to repeat: done twice keeps the first time, undo twice stays undone", async () => {
    const { ana } = await setUp();
    const added = await addChore(ana, chore());
    const first = await completeChore(ana, added.id);

    vi.setSystemTime(new Date("2026-10-29T18:00:00Z"));
    expect((await completeChore(ana, added.id)).completedAt).toEqual(first.completedAt);

    await undoChore(ana, added.id);
    expect((await undoChore(ana, added.id)).completedAt).toBeNull();
  });

  it.each([
    ["another household's chore", "theirs"],
    ["an id that isn't a uuid", "not-a-uuid"],
    ["an unknown uuid", "00000000-0000-4000-9000-999999999999"],
  ])("answers CHORE_NOT_FOUND for %s", async (_label, which) => {
    const { ana, cy } = await setUp();
    const theirs = await addChore(cy, chore({ assigneeId: "cy" }));
    const id = which === "theirs" ? theirs.id : which;

    expect(await codeOf(() => completeChore(ana, id))).toBe("CHORE_NOT_FOUND");
    expect(await codeOf(() => getChore(ana, id))).toBe("CHORE_NOT_FOUND");
  });
});
