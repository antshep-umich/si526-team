// SCRUM-6 Add a Chore.
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Household } from "../api/households.ts";
import AddChore from "./AddChore.tsx";

const { createChore, getCurrentHousehold } = vi.hoisted(() => ({
  createChore: vi.fn(),
  getCurrentHousehold: vi.fn(),
}));
vi.mock("../api/chores.ts", () => ({ createChore }));
vi.mock("../api/households.ts", () => ({ getCurrentHousehold }));

const member = (userId: string, name: string) => ({
  userId,
  name,
  role: "member" as const,
  joinedAt: "2026-10-17T00:00:00.000Z",
});

const household: Household = {
  id: "h1",
  name: "Maple St House",
  inviteCode: "K7Q2MXAB",
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
