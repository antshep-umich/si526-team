// My chore history (SCRUM-44 View user chore history).
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Household } from "../api/households.ts";
import type { Chore } from "../chores.ts";
import ChoreHistory from "./ChoreHistory.tsx";

const { listChoreHistory, getChore } = vi.hoisted(() => ({
  listChoreHistory: vi.fn(),
  getChore: vi.fn(),
}));
vi.mock("../api/chores.ts", () => ({ listChoreHistory, getChore }));

const household: Household = {
  id: "h1",
  name: "Maple St House",
  inviteCode: "K7Q2MXAB",
  createdAt: "2026-10-17T00:00:00.000Z",
  role: "owner",
  members: [],
};

// Thursday, Oct 29 2026, noon on the phone.
const NOW = new Date(2026, 9, 29, 12);
const at = (day: string, hour = 9) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!, hour).toISOString();
};

const ana = { userId: "u-ana", name: "Ana Lopez" };
const sam = { userId: "u-sam", name: "Sam Ito" };

function chore(name: string, fields: Partial<Chore> = {}): Chore {
  return {
    id: name,
    name,
    notes: null,
    dueDate: "2026-10-29",
    assignee: ana,
    createdBy: sam,
    createdAt: at("2026-10-20"),
    completedAt: null,
    completedBy: null,
    ...fields,
  };
}

// Latest due first, as the API sends them.
const history = [
  chore("Buy dish soap", { dueDate: "2026-11-02", createdAt: at("2026-10-27") }),
  chore("Wash dishes", {
    dueDate: "2026-10-28",
    createdAt: at("2026-10-21"),
    completedAt: at("2026-10-27"),
    completedBy: ana,
    notes: "Hand-wash the knives",
  }),
  chore("Mop kitchen", {
    dueDate: "2026-10-22",
    createdAt: at("2026-10-15"),
    completedAt: at("2026-10-24"),
    completedBy: ana,
  }),
  chore("Take out trash", { dueDate: "2026-10-26", createdAt: at("2026-10-19") }),
];

function renderHistory() {
  render(<ChoreHistory household={household} userId="u-ana" />);
}

// The history, grouped into one list per month.
const list = () => screen.findByRole("region", { name: "Chore history" });

/** The chore names in the list, in order. */
const names = (element: HTMLElement) =>
  within(element)
    .getAllByRole("listitem")
    .map((item) => item.querySelector("button")?.firstChild?.textContent);

const row = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  listChoreHistory.mockResolvedValue({ ok: true, chores: history });
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("My chore history", { tags: ["SCRUM-44"] }, () => {
  it("AC1: lists the user's chores with name, creation date, due date, status and completion date", async () => {
    renderHistory();

    expect(names(await list())).toEqual(["Buy dish soap", "Wash dishes", "Take out trash", "Mop kitchen"]);
    expect(screen.getByRole("heading", { name: "My chore history" })).toBeInTheDocument();
    expect(row("Wash dishes")).toHaveTextContent("Due Wed, Oct 28 · Done Tue, Oct 27");
    expect(row("Wash dishes")).toHaveTextContent("Created Wed, Oct 21");
    expect(row("Buy dish soap")).toHaveTextContent("Due Mon, Nov 2 · Not done yet");
    expect(row("Buy dish soap")).toHaveTextContent("Created Tue, Oct 27");
    // Completion status: Done, Late (done after the due date) and Overdue chips.
    const item = (name: string) => row(name).closest("li")!;
    expect(within(item("Wash dishes")).getByText("Done")).toBeInTheDocument();
    expect(within(item("Mop kitchen")).getByText("Late")).toBeInTheDocument();
    expect(within(item("Take out trash")).getByText("Overdue")).toBeInTheDocument();
  });

  it("AC2: selecting a chore shows more about it", async () => {
    getChore.mockResolvedValue({ ok: true, chore: history[1] });
    renderHistory();
    await list();

    await userEvent.click(row("Wash dishes"));

    expect(getChore).toHaveBeenCalledWith("Wash dishes");
    expect(row("Wash dishes")).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText("Hand-wash the knives")).toBeInTheDocument();
    const panel = within(document.getElementById(row("Wash dishes").getAttribute("aria-controls")!)!);
    expect(panel.getByText("Wed, Oct 21 by Sam Ito")).toBeInTheDocument();
    expect(panel.getByText("Tue, Oct 27 by You")).toBeInTheDocument();
    expect(panel.getByText("Done")).toBeInTheDocument();

    await userEvent.click(row("Wash dishes"));
    expect(screen.queryByText("Hand-wash the knives")).not.toBeInTheDocument();
  });

  it("AC3: filtering by completion status and sorting by date update the list", async () => {
    renderHistory();
    const shown = await list();

    await userEvent.click(screen.getByRole("radio", { name: "Done" }));
    expect(names(shown)).toEqual(["Wash dishes", "Mop kitchen"]);

    await userEvent.click(screen.getByRole("radio", { name: "Not done" }));
    expect(names(shown)).toEqual(["Buy dish soap", "Take out trash"]);

    await userEvent.click(screen.getByRole("radio", { name: "All" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Sort by" }));
    await userEvent.click(screen.getByRole("option", { name: "Due date, oldest first" }));
    expect(names(await list())).toEqual(["Mop kitchen", "Take out trash", "Wash dishes", "Buy dish soap"]);

    await userEvent.click(screen.getByRole("combobox", { name: "Sort by" }));
    await userEvent.click(screen.getByRole("option", { name: "Date completed, newest first" }));
    expect(names(await list())).toEqual(["Wash dishes", "Mop kitchen", "Buy dish soap", "Take out trash"]);
  });

  it("AC4: with no chores it says \"No chore history.\"", async () => {
    listChoreHistory.mockResolvedValue({ ok: true, chores: [] });
    renderHistory();

    expect(await screen.findByText("No chore history.")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("AC5: if the history fails to load it shows an error and a way to retry", async () => {
    listChoreHistory.mockResolvedValueOnce({ ok: false, code: "NETWORK_ERROR" });
    renderHistory();

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load your chore history.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(names(await list())).toHaveLength(4);
    expect(listChoreHistory).toHaveBeenCalledTimes(2);
  });

  it("AC6: a chore deleted since the list loaded shows \"Chore no longer available.\"", async () => {
    getChore.mockResolvedValue({ ok: false, code: "CHORE_NOT_FOUND" });
    renderHistory();
    await list();

    await userEvent.click(row("Take out trash"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Chore no longer available.");
  });
});

describe("My chore history, other states", () => {
  it("says when a filter matches nothing", async () => {
    listChoreHistory.mockResolvedValue({ ok: true, chores: [history[0]] });
    renderHistory();
    await list();

    await userEvent.click(screen.getByRole("radio", { name: "Done" }));

    expect(screen.getByText("No chores match this filter.")).toBeInTheDocument();
  });

  it("shows \"No description added.\" for a chore without notes", async () => {
    getChore.mockResolvedValue({ ok: true, chore: history[0] });
    renderHistory();
    await list();

    await userEvent.click(row("Buy dish soap"));

    expect(await screen.findByText("No description added.")).toBeInTheDocument();
    expect(screen.getByText("Not done yet")).toBeInTheDocument();
  });

  it("offers a retry when a chore's details fail to load", async () => {
    getChore.mockResolvedValueOnce({ ok: false, code: "NETWORK_ERROR" });
    getChore.mockResolvedValueOnce({ ok: true, chore: history[0] });
    renderHistory();
    await list();

    await userEvent.click(row("Buy dish soap"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load this chore.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("No description added.")).toBeInTheDocument();
  });
});
