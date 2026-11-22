// SCRUM-6 Add a Chore.
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChoreType } from "../../shared/preferences.ts";
import type { Household } from "../api/households.ts";
import AddChore from "./AddChore.tsx";

const { createChore, listChores, getCurrentHousehold } = vi.hoisted(() => ({
  createChore: vi.fn(),
  listChores: vi.fn(),
  getCurrentHousehold: vi.fn(),
}));
vi.mock("../api/chores.ts", () => ({ createChore, listChores }));
vi.mock("../api/households.ts", () => ({ getCurrentHousehold }));

const member = (userId: string, name: string) => ({
  userId,
  name,
  role: "member" as const,
  joinedAt: "2026-10-17T00:00:00.000Z",
  choreTypes: [] as ChoreType[],
});

const household: Household = {
  id: "h1",
  name: "Maple St House",
  inviteCode: "K7Q2MXAB",
  assignmentMethod: null,
  createdAt: "2026-10-17T00:00:00.000Z",
  role: "owner",
  members: [member("u-ana", "Ana Lopez"), member("u-ben", "Ben Ito")],
};

const saved = {
  id: "c1",
  name: "Mop kitchen",
  notes: null,
  dueDate: "2026-10-30",
  assignee: { userId: "u-ben", name: "Ben Ito" },
  createdBy: { userId: "u-ana", name: "Ana Lopez" },
  createdAt: "2026-10-29T16:00:00.000Z",
  completedAt: null,
  completedBy: null,
};

function renderAddChore(props: Partial<Parameters<typeof AddChore>[0]> = {}) {
  const callbacks = { onAdded: vi.fn(), onCancel: vi.fn() };
  render(<AddChore household={household} userId="u-ana" {...callbacks} {...props} />);
  return callbacks;
}

async function pick(name: string) {
  await userEvent.click(screen.getByRole("combobox", { name: "Assigned to" }));
  await userEvent.click(screen.getByRole("option", { name }));
}

/** Pastes rather than types, which is slow for long text. */
async function paste(label: string, text: string) {
  await userEvent.click(screen.getByLabelText(label));
  await userEvent.paste(text);
}

const setDueDate = (value: string) => fireEvent.change(screen.getByLabelText("Due date"), { target: { value } });
const submit = () => userEvent.click(screen.getByRole("button", { name: "Add chore" }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 29, 12)); // Thursday, Oct 29 2026
  getCurrentHousehold.mockResolvedValue({ ok: true, household });
  createChore.mockResolvedValue({ ok: true, chore: saved });
  listChores.mockResolvedValue({ ok: true, chores: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AddChore", () => {
  it("opens with the household name, the four fields empty, and the two buttons", () => {
    renderAddChore();

    expect(screen.getByText("Maple St House")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Add chore" })).toBeInTheDocument();
    expect(screen.getByLabelText("Chore name")).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Assigned to" })).toHaveTextContent("Select a housemate");
    expect(screen.getByLabelText("Due date")).toHaveValue("");
    expect(screen.getByLabelText("Due date")).toHaveAttribute("min", "2026-10-29");
    expect(screen.getByLabelText("Notes (optional)")).toHaveAttribute("placeholder", "Add any details…");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("lists the user first as You, then the housemates", async () => {
    renderAddChore();

    await userEvent.click(screen.getByRole("combobox", { name: "Assigned to" }));

    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["You", "Ben Ito"]);
  });

  it("shows every error at once and keeps what was typed", async () => {
    renderAddChore();
    await paste("Notes (optional)", "x".repeat(201));

    await submit();

    expect(screen.getByLabelText("Chore name")).toHaveAccessibleDescription("Chore name is required.");
    expect(screen.getByRole("combobox", { name: "Assigned to" })).toHaveAccessibleDescription(
      "Choose who this chore is assigned to.",
    );
    expect(screen.getByLabelText("Due date")).toHaveAccessibleDescription("Choose a due date.");
    expect(screen.getByLabelText("Notes (optional)")).toHaveAccessibleDescription(
      "Notes must be 200 characters or fewer.",
    );
    expect(screen.getByLabelText("Notes (optional)")).toHaveValue("x".repeat(201));
    expect(createChore).not.toHaveBeenCalled();
  });

  it("rejects a long name and a past due date", async () => {
    renderAddChore();
    await paste("Chore name", "x".repeat(61));
    setDueDate("2026-10-28");

    await submit();

    expect(screen.getByLabelText("Chore name")).toHaveAccessibleDescription(
      "Chore name must be 60 characters or fewer.",
    );
    expect(screen.getByLabelText("Due date")).toHaveAccessibleDescription("Due date can't be in the past.");
  });

  it("saves the chore with trimmed text and returns to the list", async () => {
    const { onAdded } = renderAddChore();
    await userEvent.type(screen.getByLabelText("Chore name"), "  Mop kitchen ");
    await pick("Ben Ito");
    setDueDate("2026-10-30");
    await userEvent.type(screen.getByLabelText("Notes (optional)"), " Use the blue bucket ");

    await submit();

    expect(createChore).toHaveBeenCalledWith({
      name: "Mop kitchen",
      assigneeId: "u-ben",
      dueDate: "2026-10-30",
      notes: "Use the blue bucket",
    });
    expect(onAdded).toHaveBeenCalledWith(saved);
  });

  it("leaves notes out when there are none, and allows today", async () => {
    renderAddChore();
    await userEvent.type(screen.getByLabelText("Chore name"), "Mop kitchen");
    await pick("You");
    setDueDate("2026-10-29");

    await submit();

    expect(createChore).toHaveBeenCalledWith({ name: "Mop kitchen", assigneeId: "u-ana", dueDate: "2026-10-29" });
  });

  it("keeps the form open with its values when saving fails", async () => {
    createChore.mockResolvedValue({ ok: false, code: "NETWORK_ERROR" });
    const { onAdded } = renderAddChore();
    await userEvent.type(screen.getByLabelText("Chore name"), "Mop kitchen");
    await pick("You");
    setDueDate("2026-10-30");

    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save this chore. Please try again.");
    expect(screen.getByLabelText("Chore name")).toHaveValue("Mop kitchen");
    expect(onAdded).not.toHaveBeenCalled();
  });

  it("shows the server's past-date answer on the date field", async () => {
    createChore.mockResolvedValue({ ok: false, code: "DUE_DATE_IN_PAST" });
    renderAddChore();
    await userEvent.type(screen.getByLabelText("Chore name"), "Mop kitchen");
    await pick("You");
    setDueDate("2026-10-29");

    await submit();

    expect(screen.getByLabelText("Due date")).toHaveAccessibleDescription("Due date can't be in the past.");
  });

  it("hints at the invite code when the user is the only member", async () => {
    const alone = { ...household, members: [member("u-ana", "Ana Lopez")] };
    getCurrentHousehold.mockResolvedValue({ ok: true, household: alone });
    renderAddChore({ household: alone });

    await userEvent.click(screen.getByRole("combobox", { name: "Assigned to" }));

    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["You"]);
    expect(screen.getByRole("combobox", { name: "Assigned to" })).toHaveAccessibleDescription(
      "Invite housemates with code K7Q2MXAB to assign chores to them.",
    );
  });

  it("picks up housemates who joined since the list was loaded", async () => {
    getCurrentHousehold.mockResolvedValue({
      ok: true,
      household: { ...household, members: [...household.members, member("u-cy", "Cy Park")] },
    });
    renderAddChore();

    await userEvent.click(screen.getByRole("combobox", { name: "Assigned to" }));

    expect(await screen.findByRole("option", { name: "Cy Park" })).toBeInTheDocument();
  });

  it("cancels without saving", async () => {
    const { onCancel } = renderAddChore();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(createChore).not.toHaveBeenCalled();
  });
});

describe("AddChore acceptance criteria", { tags: ["SCRUM-6"] }, () => {
  /** Fills every required field except the ones named, then saves. */
  async function saveWithout(...missing: ("name" | "assignee" | "dueDate")[]) {
    renderAddChore();
    if (!missing.includes("name")) await userEvent.type(screen.getByLabelText("Chore name"), "Mop kitchen");
    if (!missing.includes("assignee")) await pick("Ben Ito");
    if (!missing.includes("dueDate")) setDueDate("2026-10-30");
    await submit();
  }

  it('AC2: "Assigned to" opens a dropdown listing every housemate in the household', async () => {
    renderAddChore();

    await userEvent.click(screen.getByRole("combobox", { name: "Assigned to" }));

    expect(screen.getByRole("listbox", { name: "Assigned to" })).toBeVisible();
    // Both members: the user (shown as "You") and Ben.
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["You", "Ben Ito"]);
  });

  it('AC3: "Due date" opens a date picker', async () => {
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, "showPicker", { value: showPicker, configurable: true });
    try {
      renderAddChore();

      await userEvent.click(screen.getByLabelText("Due date"));

      expect(screen.getByLabelText("Due date")).toHaveAttribute("type", "date");
      expect(showPicker).toHaveBeenCalledTimes(1);
    } finally {
      delete (HTMLInputElement.prototype as { showPicker?: unknown }).showPicker;
    }
  });

  it('AC6: says "Chore name is required." when the name is empty', async () => {
    await saveWithout("name");

    expect(screen.getByLabelText("Chore name")).toHaveAccessibleDescription("Chore name is required.");
    expect(createChore).not.toHaveBeenCalled();
  });

  it('AC7: says "Choose who this chore is assigned to." when no housemate is selected', async () => {
    await saveWithout("assignee");

    expect(screen.getByRole("combobox", { name: "Assigned to" })).toHaveAccessibleDescription(
      "Choose who this chore is assigned to.",
    );
    expect(createChore).not.toHaveBeenCalled();
  });

  it('AC8: says "Choose a due date." when no due date is selected', async () => {
    await saveWithout("dueDate");

    expect(screen.getByLabelText("Due date")).toHaveAccessibleDescription("Choose a due date.");
    expect(createChore).not.toHaveBeenCalled();
  });

  it("AC9: says \"Couldn't save this chore. Please try again.\" on a server error", async () => {
    createChore.mockResolvedValue({ ok: false, code: "INTERNAL_ERROR" });

    await saveWithout();

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save this chore. Please try again.");
  });
});

describe("Chore category and housemates' preferences", { tags: ["SCRUM-61"] }, () => {
  const withPreferences: Household = {
    ...household,
    members: [member("u-ana", "Ana Lopez"), { ...member("u-ben", "Ben Ito"), choreTypes: ["trash", "dishes"] }],
  };

  async function pickCategory(name: string) {
    await userEvent.click(screen.getByRole("combobox", { name: "Category (optional)" }));
    await userEvent.click(screen.getByRole("option", { name }));
  }

  it("puts the optional Category between Chore name and Assigned to", () => {
    renderAddChore();
    const name = screen.getByLabelText("Chore name");
    const category = screen.getByRole("combobox", { name: "Category (optional)" });
    const assignee = screen.getByRole("combobox", { name: "Assigned to" });

    expect(name.compareDocumentPosition(category)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(category.compareDocumentPosition(assignee)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("AC3: housemates who prefer the chore's category are shown as preferring it", async () => {
    getCurrentHousehold.mockResolvedValue({ ok: true, household: withPreferences });
    renderAddChore({ household: withPreferences });

    await pickCategory("Trash & recycling");
    await userEvent.click(screen.getByRole("combobox", { name: "Assigned to" }));

    // Since SCRUM-64 the note is the option's second line, with their open chores.
    expect(screen.getByRole("option", { name: /^Ben Ito · Prefers this chore/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "You" })).toBeInTheDocument();
  });

  it("AC3: nobody is marked before a category is picked, or when nobody prefers it", async () => {
    getCurrentHousehold.mockResolvedValue({ ok: true, household: withPreferences });
    renderAddChore({ household: withPreferences });

    await userEvent.click(screen.getByRole("combobox", { name: "Assigned to" }));
    expect(screen.getByRole("option", { name: "Ben Ito" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    await pickCategory("Laundry");
    await userEvent.click(screen.getByRole("combobox", { name: "Assigned to" }));
    expect(screen.getByRole("option", { name: "Ben Ito" })).toBeInTheDocument();
  });

  it("saves the category with the chore, and leaves it out when there's none", async () => {
    renderAddChore();
    await userEvent.type(screen.getByLabelText("Chore name"), "Mop kitchen");
    await pickCategory("Mopping");
    await pick("Ben Ito");
    setDueDate("2026-10-30");
    await submit();

    expect(createChore).toHaveBeenLastCalledWith(expect.objectContaining({ name: "Mop kitchen", category: "mopping" }));
  });

  it("can go back to No category", async () => {
    renderAddChore();
    await userEvent.type(screen.getByLabelText("Chore name"), "Mop kitchen");
    await pickCategory("Mopping");
    await pickCategory("No category");
    await pick("Ben Ito");
    setDueDate("2026-10-30");
    await submit();

    expect(createChore.mock.lastCall![0]).not.toHaveProperty("category");
  });
});

describe("Suggested housemates in Assigned to", { tags: ["SCRUM-64"] }, () => {
  const prefers = (userId: string, name: string, choreTypes: ChoreType[]) => ({ ...member(userId, name), choreTypes });
  // In joining order. You, Ben and Dev like trash; Cleo likes nothing in particular.
  const house: Household = {
    ...household,
    members: [
      prefers("u-ana", "Ana Lopez", ["trash"]),
      prefers("u-ben", "Ben Ito", ["trash", "dishes"]),
      member("u-cleo", "Cleo Park"),
      prefers("u-dev", "Dev Rao", ["trash"]),
    ],
  };
  const open = (id: string, assignee: { userId: string; name: string }) => ({
    ...saved,
    id,
    name: id,
    assignee,
  });
  // Open chores: You 2, Ben 1, Dev 1, Cleo 0. Ben's done chore doesn't count.
  const chores = [
    open("a1", { userId: "u-ana", name: "Ana Lopez" }),
    open("a2", { userId: "u-ana", name: "Ana Lopez" }),
    open("b1", { userId: "u-ben", name: "Ben Ito" }),
    { ...open("b2", { userId: "u-ben", name: "Ben Ito" }), completedAt: "2026-10-28T12:00:00.000Z" },
    open("d1", { userId: "u-dev", name: "Dev Rao" }),
  ];

  beforeEach(() => {
    getCurrentHousehold.mockResolvedValue({ ok: true, household: house });
    listChores.mockResolvedValue({ ok: true, chores });
  });

  async function pickCategory(name: string) {
    await userEvent.click(screen.getByRole("combobox", { name: "Category (optional)" }));
    await userEvent.click(screen.getByRole("option", { name }));
  }

  async function openAssignedTo() {
    await userEvent.click(screen.getByRole("combobox", { name: "Assigned to" }));
    return screen.getByRole("listbox", { name: "Assigned to" });
  }

  // What each option is called, as a screen reader says it.
  const optionNames = (element: HTMLElement) =>
    within(element)
      .getAllByRole("option")
      .map((o) => o.getAttribute("aria-label") ?? o.textContent);
  const group = (list: HTMLElement, name: string) => within(list).queryByRole("group", { name });

  it("AC1: housemates who prefer the chore come first under Suggested, labeled, with their open chores, most first", async () => {
    renderAddChore({ household: house });
    await pickCategory("Trash & recycling");

    const list = await openAssignedTo();

    expect(optionNames(group(list, "Suggested")!)).toEqual([
      "You · Prefers this chore · 2 open chores",
      "Ben Ito · Prefers this chore · 1 open chore",
      "Dev Rao · Prefers this chore · 1 open chore",
    ]);
    expect(optionNames(group(list, "Everyone else")!)).toEqual(["Cleo Park"]);
    expect(listChores).toHaveBeenCalledWith("2026-10-29");
  });

  it("AC2: for a chore no one prefers, all housemates are listed with no Suggested section", async () => {
    renderAddChore({ household: house });
    await pickCategory("Laundry");

    const list = await openAssignedTo();

    expect(group(list, "Suggested")).not.toBeInTheDocument();
    expect(optionNames(list)).toEqual(["You", "Ben Ito", "Cleo Park", "Dev Rao"]);
  });

  it("AC3: before a category is picked, all housemates are listed; suggestions appear once it is", async () => {
    renderAddChore({ household: house });

    let list = await openAssignedTo();
    expect(group(list, "Suggested")).not.toBeInTheDocument();
    expect(optionNames(list)).toEqual(["You", "Ben Ito", "Cleo Park", "Dev Rao"]);
    await userEvent.keyboard("{Escape}");

    await pickCategory("Trash & recycling");
    list = await openAssignedTo();
    expect(group(list, "Suggested")).toBeInTheDocument();
  });

  it("AC4: changing the category updates the suggestions", async () => {
    renderAddChore({ household: house });
    await pickCategory("Trash & recycling");
    await openAssignedTo();
    await userEvent.keyboard("{Escape}");

    await pickCategory("Dishes");
    const list = await openAssignedTo();

    expect(optionNames(group(list, "Suggested")!)).toEqual(["Ben Ito · Prefers this chore · 1 open chore"]);
    expect(optionNames(group(list, "Everyone else")!)).toEqual(["You", "Cleo Park", "Dev Rao"]);
  });

  it("AC5: any housemate can be picked, suggested or not", async () => {
    renderAddChore({ household: house });
    await userEvent.type(screen.getByLabelText("Chore name"), "Take out trash");
    await pickCategory("Trash & recycling");
    await openAssignedTo();
    await userEvent.click(screen.getByRole("option", { name: "Cleo Park" }));
    setDueDate("2026-10-30");

    await submit();

    expect(screen.getByRole("combobox", { name: "Assigned to" })).toHaveTextContent("Cleo Park");
    expect(createChore).toHaveBeenCalledWith(expect.objectContaining({ assigneeId: "u-cleo", category: "trash" }));
  });

  it("AC6: a housemate who prefers the chore but has left isn't suggested", async () => {
    // Eve was there when the app loaded the household, and has left since.
    const withEve = { ...house, members: [...house.members, prefers("u-eve", "Eve Moss", ["trash"])] };
    renderAddChore({ household: withEve });
    await pickCategory("Trash & recycling");

    const list = await openAssignedTo();

    expect(within(list).queryByRole("option", { name: /Eve Moss/ })).not.toBeInTheDocument();
  });

  it("AC7: if preferences fail to load, everyone is listed as normal with \"Suggestions aren’t available right now.\", and assigning still works", async () => {
    getCurrentHousehold.mockResolvedValue({ ok: false, code: "NETWORK_ERROR" });
    renderAddChore({ household: house });
    await pickCategory("Trash & recycling");

    const list = await openAssignedTo();

    expect(group(list, "Suggested")).not.toBeInTheDocument();
    expect(optionNames(list)).toEqual(["You", "Ben Ito", "Cleo Park", "Dev Rao"]);
    expect(screen.getByRole("combobox", { name: "Assigned to" })).toHaveAccessibleDescription(
      "Suggestions aren’t available right now.",
    );
    await userEvent.click(screen.getByRole("option", { name: "Dev Rao" }));
    expect(screen.getByRole("combobox", { name: "Assigned to" })).toHaveTextContent("Dev Rao");
  });
});
