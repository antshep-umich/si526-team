// Edit chore (Figma "Home - Edit chore"): the Add chore form, filled in with the chore's.
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChoreType } from "../../shared/preferences.ts";
import type { Household } from "../api/households.ts";
import type { Chore } from "../chores.ts";
import EditChore from "./EditChore.tsx";

const { editChore, getCurrentHousehold } = vi.hoisted(() => ({
  editChore: vi.fn(),
  getCurrentHousehold: vi.fn(),
}));
vi.mock("../api/chores.ts", () => ({ editChore }));
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

// Due yesterday, so it's overdue: the date may stay, but can't move to another past day.
const chore: Chore = {
  id: "c1",
  name: "Take out trash",
  notes: "Bins by the gate",
  dueDate: "2026-10-28",
  assignee: { userId: "u-ben", name: "Ben Ito" },
  createdBy: { userId: "u-ana", name: "Ana Lopez" },
  createdAt: "2026-10-20T16:00:00.000Z",
  completedAt: null,
  completedBy: null,
};

function renderEditChore(edited: Chore = chore) {
  const callbacks = { onSaved: vi.fn(), onCancel: vi.fn() };
  render(<EditChore household={household} userId="u-ana" chore={edited} {...callbacks} />);
  return callbacks;
}

const save = () => userEvent.click(screen.getByRole("button", { name: "Save chore" }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 29, 12)); // Thursday, Oct 29 2026
  getCurrentHousehold.mockResolvedValue({ ok: true, household });
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("Edit chore", () => {
  it("shows the chore's name, assignee, due date and notes under the household's name", async () => {
    renderEditChore();

    expect(screen.getByRole("heading", { level: 1, name: "Edit chore" })).toBeInTheDocument();
    expect(screen.getByText("Maple St House")).toBeInTheDocument();
    expect(screen.getByLabelText("Chore name")).toHaveValue("Take out trash");
    expect(screen.getByRole("combobox", { name: "Assigned to" })).toHaveTextContent("Ben Ito");
    expect(screen.getByLabelText("Due date")).toHaveValue("2026-10-28");
    expect(screen.getByLabelText("Notes (optional)")).toHaveValue("Bins by the gate");
  });

  it("saves the changes and hands back the saved chore", async () => {
    const saved = { ...chore, name: "Recycling", assignee: { userId: "u-ana", name: "Ana Lopez" } };
    editChore.mockResolvedValue({ ok: true, chore: saved });
    const { onSaved } = renderEditChore();

    await userEvent.clear(screen.getByLabelText("Chore name"));
    await userEvent.type(screen.getByLabelText("Chore name"), "Recycling");
    await userEvent.click(screen.getByRole("combobox", { name: "Assigned to" }));
    await userEvent.click(screen.getByRole("option", { name: "You" }));
    await save();

    expect(editChore).toHaveBeenCalledWith("c1", {
      name: "Recycling",
      assigneeId: "u-ana",
      dueDate: "2026-10-28",
      notes: "Bins by the gate",
    });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it("keeps a due date that has passed, but won't move it to another past day", async () => {
    editChore.mockResolvedValue({ ok: true, chore });
    renderEditChore();

    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-10-27" } });
    await save();
    expect(screen.getByText("Due date can't be in the past.")).toBeInTheDocument();
    expect(editChore).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-10-28" } });
    await save();
    expect(editChore).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["NOT_ALLOWED_TO_EDIT", "Only the household owner or the person who added this chore can edit it."],
    ["CHORE_NOT_FOUND", "Chore no longer available."],
    ["NETWORK_ERROR", "Couldn't save this chore. Please try again."],
  ])("says why it couldn't save (%s)", async (code, message) => {
    editChore.mockResolvedValue({ ok: false, code });
    const { onSaved } = renderEditChore();

    await save();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("goes back without saving on Cancel", async () => {
    const { onCancel } = renderEditChore();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(editChore).not.toHaveBeenCalled();
  });
});

describe("Chore category", { tags: ["SCRUM-61"] }, () => {
  it("shows the chore's category and keeps it when saving", async () => {
    editChore.mockResolvedValue({ ok: true, chore });
    renderEditChore({ ...chore, category: "trash" });

    expect(screen.getByRole("combobox", { name: "Category (optional)" })).toHaveTextContent("Trash & recycling");
    await save();

    expect(editChore).toHaveBeenCalledWith("c1", expect.objectContaining({ category: "trash" }));
  });

  it("clears the category with No category", async () => {
    editChore.mockResolvedValue({ ok: true, chore });
    renderEditChore({ ...chore, category: "trash" });

    await userEvent.click(screen.getByRole("combobox", { name: "Category (optional)" }));
    await userEvent.click(screen.getByRole("option", { name: "No category" }));
    await save();

    expect(editChore.mock.lastCall![1]).not.toHaveProperty("category");
  });
});

