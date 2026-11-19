// Household chore history, weekly view (SCRUM-46 View household chore history - weekly).
// The monthly view's tests are in MonthlyChoreHistory.test.tsx.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Household } from "../api/households.ts";
import type { Chore } from "../chores.ts";
import HouseholdChoreHistory from "./HouseholdChoreHistory.tsx";

const { listChores, getChoreHistory } = vi.hoisted(() => ({
  listChores: vi.fn(),
  getChoreHistory: vi.fn(),
}));
vi.mock("../api/chores.ts", () => ({ listChores, getChoreHistory }));

const household: Household = {
  id: "h1",
  name: "Maple St House",
  inviteCode: "K7Q2MXAB",
  createdAt: "2026-09-01T00:00:00.000Z",
  role: "owner",
  members: [],
};

// Thursday, Nov 12 2026, noon on the phone. This week runs Monday Nov 9 to Sunday Nov 15.
const NOW = new Date(2026, 10, 12, 12);
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
    dueDate: "2026-11-12",
    assignee: ana,
    createdBy: sam,
    createdAt: at("2026-10-20"),
    completedAt: null,
    completedBy: null,
    ...fields,
  };
}

const thisWeek = [
  chore("Wash dishes", { dueDate: "2026-11-09", completedAt: at("2026-11-10"), completedBy: ana }), // done late
  chore("Take out trash", { dueDate: "2026-11-10", assignee: sam }), // overdue
  chore("Mop kitchen", { dueDate: "2026-11-11", assignee: sam, completedAt: at("2026-11-11"), completedBy: sam }), // done
  chore("Buy dish soap", { dueDate: "2026-11-14" }), // to do
];
const lastWeek = [chore("Rake leaves", { dueDate: "2026-11-03", assignee: sam, completedAt: at("2026-11-04"), completedBy: sam })];
const nextWeek = [chore("Hang lights", { dueDate: "2026-11-18", assignee: sam })];

function renderHistory() {
  render(<HouseholdChoreHistory household={household} userId="u-ana" />);
}

const list = (title = "Chores this week") => screen.findByRole("list", { name: title });
const rows = (element: HTMLElement) => within(element).getAllByRole("listitem");
// Each row is a button whose first part is the chore's name.
const names = (element: HTMLElement) => rows(element).map((item) => item.querySelector("button")?.firstChild?.textContent);
const row = (element: HTMLElement, name: string) => rows(element).find((item) => within(item).queryByText(name))!;

/** A row's lines: first the due date and what happened, then who the chore is for. */
function lines(element: HTMLElement, name: string) {
  const button = within(row(element, name)).getByRole("button");
  const described = document.getElementById(button.getAttribute("aria-describedby")!)!;
  return Array.from(described.children, (line) => line.textContent);
}

/** The summary's numbers by label, for example { Completed: 2, Incomplete: 2, Overdue: 1 }. */
function summary() {
  const region = screen.getByRole("region", { name: "Weekly chore summary" });
  return Object.fromEntries(
    Array.from(region.children).map((tile) => [
      tile.querySelector("span")!.textContent,
      Number(tile.querySelector("strong")!.textContent),
    ]),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  // What GET /api/chores?since=… sends: everything open, plus what's done or due since then.
  listChores.mockImplementation(async (since: string) => ({
    ok: true,
    chores: since <= "2026-11-02" ? [...lastWeek, ...thisWeek, ...nextWeek] : [...thisWeek, ...nextWeek],
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("Household chore history, weekly view", { tags: ["SCRUM-46"] }, () => {
  it("AC1: the weekly view shows this week's household chores with name, housemate, status, due date and completion date", async () => {
    renderHistory();

    expect(screen.getByRole("radio", { name: "Weekly" })).toBeChecked();
    const week = await list();
    expect(listChores).toHaveBeenCalledWith("2026-11-09");
    expect(names(week)).toEqual(expect.arrayContaining(["Wash dishes", "Take out trash", "Mop kitchen", "Buy dish soap"]));
    expect(names(week)).toHaveLength(4);

    expect(lines(week, "Mop kitchen")).toEqual(["Due Wed, Nov 11 · Done Wed, Nov 11", "Sam Ito"]);
    expect(within(row(week, "Mop kitchen")).getByText("Done")).toBeInTheDocument();
    expect(lines(week, "Wash dishes")).toEqual(["Due Mon, Nov 9 · Done Tue, Nov 10", "You"]);
    expect(within(row(week, "Wash dishes")).getByText("Late")).toBeInTheDocument();
    expect(lines(week, "Take out trash")).toEqual(["Due Tue, Nov 10 · Not done yet", "Sam Ito"]);
    expect(within(row(week, "Take out trash")).getByText("Overdue")).toBeInTheDocument();
  });

  it("AC2: going to the previous or next week shows that week's chores", async () => {
    renderHistory();
    await list();

    await userEvent.click(screen.getByRole("button", { name: "Previous week" }));
    expect(screen.getByRole("region", { name: "Week" })).toHaveTextContent("Nov 2–8");
    expect(listChores).toHaveBeenLastCalledWith("2026-11-02");
    expect(names(await list())).toEqual(["Rake leaves"]);

    await userEvent.click(screen.getByRole("button", { name: "Next week" }));
    await userEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.getByRole("region", { name: "Week" })).toHaveTextContent("Nov 16–22");
    expect(names(await list())).toEqual(["Hang lights"]);
  });

  it("AC3: selecting a day shows the chores for that day", async () => {
    renderHistory();
    await list();

    await userEvent.click(within(screen.getByRole("group", { name: "Select a day" })).getByRole("button", { name: "Tue, Nov 10" }));

    // Due that day, or done that day.
    expect(names(await list("Tue, Nov 10"))).toEqual(expect.arrayContaining(["Take out trash", "Wash dishes"]));
    expect(rows(await list("Tue, Nov 10"))).toHaveLength(2);
  });

  it("AC4: the summary counts the week's completed, incomplete and overdue chores", async () => {
    renderHistory();
    await list();

    expect(summary()).toEqual({ Completed: 2, Incomplete: 2, Overdue: 1 });
  });

  it("AC5: selecting a chore opens its individual history", async () => {
    getChoreHistory.mockResolvedValue({ ok: true, chore: thisWeek[2], history: [] });
    renderHistory();

    await userEvent.click(within(await list()).getByRole("button", { name: "View history for Mop kitchen" }));

    expect(getChoreHistory).toHaveBeenCalledWith("Mop kitchen");
    expect(await screen.findByRole("heading", { level: 1, name: "Mop kitchen" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chore details" })).toBeInTheDocument();
  });
});
