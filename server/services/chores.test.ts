// Chore rules (SCRUM-6, 7, 8), with in-memory models and a fixed clock.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../test/fakeModels.js";
import {
  addChore,
  completeChore,
  editChore,
  getChore,
  getChoreHistory,
  listChores,
  listMyChoreHistory,
  undoChore,
} from "./chores.js";
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

describe("editChore (the pencil in a chore's details)", () => {
  it("lets the household owner and the chore's creator edit it, and nobody else", async () => {
    const { ana, ben, cy } = await setUp();
    const byBen = await addChore(ben, chore({ assigneeId: "ben" }));
    const byAna = await addChore(ana, chore());

    expect((await editChore(ana, byBen.id, chore({ name: "Owner's edit", assigneeId: "ben" }))).name).toBe("Owner's edit");
    expect((await editChore(ben, byBen.id, chore({ name: "Creator's edit", assigneeId: "ben" }))).name).toBe("Creator's edit");
    expect(await codeOf(() => editChore(ben, byAna.id, chore({ name: "Not mine" })))).toBe("NOT_ALLOWED_TO_EDIT");
    expect(await codeOf(() => editChore(cy, byAna.id, chore()))).toBe("CHORE_NOT_FOUND");
  });

  it("changes the name, notes, assignee and due date, and records a new due date in the history", async () => {
    const { ana } = await setUp();
    const added = await addChore(ana, chore());

    const edited = await editChore(ana, added.id, { name: "Recycling", assigneeId: "ben", dueDate: "2026-11-02", notes: "Blue bin" });

    expect(edited).toMatchObject({ name: "Recycling", notes: "Blue bin", assigneeId: "ben" });
    expect(edited.dueDate.toISOString().slice(0, 10)).toBe("2026-11-02");
    const { history } = await getChoreHistory(ana, added.id);
    expect(history.map((event) => event.eventType)).toEqual(["due_date_changed", "created"]);
  });

  it("doesn't record a history event when the due date stays the same", async () => {
    const { ana } = await setUp();
    const added = await addChore(ana, chore());

    await editChore(ana, added.id, chore({ name: "Trash and recycling" }));

    expect((await getChoreHistory(ana, added.id)).history).toHaveLength(1);
  });

  it("keeps a due date that has since passed, but won't move one into the past", async () => {
    const { ana } = await setUp();
    const added = await addChore(ana, chore({ dueDate: "2026-10-30" }));
    vi.setSystemTime(new Date("2026-11-05T15:00:00Z"));

    expect((await editChore(ana, added.id, chore({ name: "Late trash" }))).name).toBe("Late trash");
    expect(await codeOf(() => editChore(ana, added.id, chore({ dueDate: "2026-11-01" })))).toBe("DUE_DATE_IN_PAST");
  });

  it("checks the form like Add chore does", async () => {
    const { ana } = await setUp();
    const added = await addChore(ana, chore());

    expect(await codeOf(() => editChore(ana, added.id, chore({ name: " " })))).toBe("VALIDATION_ERROR");
    expect(await codeOf(() => editChore(ana, added.id, chore({ assigneeId: "cy" })))).toBe("ASSIGNEE_NOT_IN_HOUSEHOLD");
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


describe("listMyChoreHistory (personal chore history)", () => {
  it("lists every chore assigned to the caller, done or not and however old, latest due first", async () => {
    const { ana, ben } = await setUp();
    const old = await addChore(ben, chore({ name: "Old", dueDate: "2026-10-28" }));
    await completeChore(ana, old.id);
    await addChore(ben, chore({ name: "Later", dueDate: "2026-11-20" }));
    await addChore(ana, chore({ name: "Ben's", assigneeId: "ben" }));

    // A month on, the old chore is still in Ana's history.
    vi.setSystemTime(new Date("2026-12-15T12:00:00Z"));
    const history = await listMyChoreHistory(ana);

    expect(history.map((c) => c.name)).toEqual(["Later", "Old"]);
    expect(history[1]!.completedById).toBe("ana");
  });

  it("never includes another household's chores", async () => {
    const { ana, cy } = await setUp();
    await addChore(ana, chore());

    expect(await listMyChoreHistory(cy)).toEqual([]);
  });
});

describe("getChoreHistory (SCRUM-45)", () => {
  it("records when a chore is created", async () => {
    const { ana } = await setUp();

    const added = await addChore(ana, chore());

    expect(db.choreHistory).toHaveLength(1);
    expect(db.choreHistory[0]).toMatchObject({
      choreId: added.id,
      eventType: "created",
      actorId: "ana",
    });
  });

  it("records when a chore is completed and reopened", async () => {
    const { ana } = await setUp();
    const added = await addChore(ana, chore());

    await completeChore(ana, added.id);
    await undoChore(ana, added.id);

    expect(db.choreHistory.map((event) => event.eventType)).toEqual([
      "created",
      "completed",
      "reopened",
    ]);
  });

  it("returns the chore and its history with newest events first", async () => {
    const { ana } = await setUp();
    const added = await addChore(ana, chore());

    vi.setSystemTime(new Date("2026-10-29T16:00:00Z"));
    await completeChore(ana, added.id);

    vi.setSystemTime(new Date("2026-10-29T17:00:00Z"));
    await undoChore(ana, added.id);

    const result = await getChoreHistory(ana, added.id);

    expect(result.chore.id).toBe(added.id);
    expect(result.history.map((event) => event.eventType)).toEqual([
      "reopened",
      "completed",
      "created",
    ]);
  });

  it("does not return history for another household's chore", async () => {
    const { ana, cy } = await setUp();
    const theirs = await addChore(cy, chore({ assigneeId: "cy" }));

    expect(await codeOf(() => getChoreHistory(ana, theirs.id))).toBe("CHORE_NOT_FOUND");
  });

  it("returns an empty history when a chore has no history events", async () => {
    const { ana } = await setUp();
    const added = await addChore(ana, chore());

    db.choreHistory.length = 0;

    const result = await getChoreHistory(ana, added.id);

    expect(result.history).toEqual([]);
  });
});
