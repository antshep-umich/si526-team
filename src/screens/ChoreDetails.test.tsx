// Chore details (SCRUM-53 View chore details & description).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Household } from "../api/households.ts";
import type { Chore } from "../chores.ts";
import ChoreDetails from "./ChoreDetails.tsx";

const { getChore } = vi.hoisted(() => ({ getChore: vi.fn() }));
vi.mock("../api/chores.ts", () => ({ getChore }));

const household: Household = {
  id: "h1",
  name: "Maple St House",
  inviteCode: "K7Q2MXAB",
  assignmentMethod: null,
  createdAt: "2026-10-17T00:00:00.000Z",
  role: "owner",
  members: [],
};

// Thursday, Oct 29 2026, noon on the phone.
const NOW = new Date(2026, 9, 29, 12);

const ana = { userId: "u-ana", name: "Ana Lopez" };
const sam = { userId: "u-sam", name: "Sam Ito" };

function chore(fields: Partial<Chore> = {}): Chore {
  return {
    id: "c1",
    name: "Take out trash",
    notes: "Bring all house trash to the dumpster outside",
    dueDate: "2026-11-05",
    assignee: sam,
    createdBy: ana,
    createdAt: new Date(2026, 9, 20, 9).toISOString(),
    completedAt: null,
    completedBy: null,
    ...fields,
  };
}

function renderDetails() {
  render(<ChoreDetails household={household} userId="u-ana" choreId="c1" />);
}

/** The value shown under a field label. */
const field = (label: string) => screen.getByText(label, { selector: "dt" }).nextElementSibling;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("Chore details", { tags: ["SCRUM-53"] }, () => {
  it("AC1: shows the chore's name, assigned housemate, due date, completion status and description", async () => {
    getChore.mockResolvedValue({ ok: true, chore: chore() });
    renderDetails();

    expect(await screen.findByRole("heading", { level: 1, name: "Take out trash" })).toBeInTheDocument();
    expect(screen.getByText("Maple St House")).toBeInTheDocument();
    expect(field("Assigned to")).toHaveTextContent("Sam Ito");
    expect(field("Due date")).toHaveTextContent("November 5, 2026");
    expect(field("Status")).toHaveTextContent("To do");
    expect(field("Notes")).toHaveTextContent("Bring all house trash to the dumpster outside");
    expect(getChore).toHaveBeenCalledWith("c1");
  });

  it("AC1: a done chore shows when it was done, and the user's own chore says \"You\"", async () => {
    getChore.mockResolvedValue({
      ok: true,
      chore: chore({
        assignee: ana,
        dueDate: "2026-10-26",
        completedAt: new Date(2026, 9, 28, 18).toISOString(),
        completedBy: ana,
      }),
    });
    renderDetails();

    await screen.findByRole("heading", { level: 1, name: "Take out trash" });
    expect(field("Assigned to")).toHaveTextContent("You");
    expect(field("Status")).toHaveTextContent("Done late · October 28, 2026");
  });

  it("AC2: a chore with no description shows \"No description added.\"", async () => {
    getChore.mockResolvedValue({ ok: true, chore: chore({ notes: null }) });
    renderDetails();

    await screen.findByRole("heading", { level: 1, name: "Take out trash" });
    expect(field("Notes")).toHaveTextContent("No description added.");
  });

  // AC3 (Back) is the Chores tab, tested in App.test.tsx (README Conflicts row 33).
  it("has the shared header with the menu and no Back link", async () => {
    getChore.mockResolvedValue({ ok: true, chore: chore() });
    renderDetails();

    expect(await screen.findByRole("heading", { level: 1, name: "Take out trash" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Back/ })).not.toBeInTheDocument();
  });

  it("AC4: a deleted chore shows \"Chore no longer available.\"", async () => {
    getChore.mockResolvedValue({ ok: false, code: "CHORE_NOT_FOUND" });
    renderDetails();

    expect(await screen.findByRole("alert")).toHaveTextContent("Chore no longer available.");
    expect(screen.queryByText("Assigned to")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Chore details" })).toBeInTheDocument();
  });

  it("AC5: when the details fail to load it shows an error and retries", async () => {
    getChore.mockResolvedValueOnce({ ok: false, code: "NETWORK_ERROR" });
    getChore.mockResolvedValueOnce({ ok: true, chore: chore() });
    renderDetails();

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load this chore.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Take out trash" })).toBeInTheDocument();
    expect(getChore).toHaveBeenCalledTimes(2);
  });

  it("shows a loading message until the chore arrives", async () => {
    getChore.mockReturnValue(new Promise(() => {}));
    renderDetails();

    expect(screen.getByRole("status")).toHaveTextContent("Loading chore…");
    expect(screen.getByRole("heading", { level: 1, name: "Chore details" })).toBeInTheDocument();
  });

  it("says \"Someone who left\" when the assignee has left the household", async () => {
    getChore.mockResolvedValue({ ok: true, chore: chore({ assignee: null }) });
    renderDetails();

    await screen.findByRole("heading", { level: 1, name: "Take out trash" });
    expect(field("Assigned to")).toHaveTextContent("Someone who left");
  });
});
