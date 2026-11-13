// Household chore history, monthly view (SCRUM-47 View household chore history - monthly).
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

// Thursday, Nov 12 2026, noon on the phone.
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
    createdAt: at("2026-09-20"),
    completedAt: null,
    completedBy: null,
    ...fields,
  };
}

// What GET /api/chores?since=… sends: everything open, plus what's done or due since then.
const november = [
  chore("Wash dishes", { dueDate: "2026-11-05", completedAt: at("2026-11-04"), completedBy: ana, notes: "Hand-wash the knives" }),
  chore("Mop kitchen", { dueDate: "2026-11-06", assignee: sam, completedAt: at("2026-11-08"), completedBy: sam }),
  chore("Take out trash", { dueDate: "2026-11-10", assignee: sam }),
  chore("Buy dish soap", { dueDate: "2026-11-20" }),
];
const october = [
  chore("Rake leaves", { dueDate: "2026-10-31", assignee: sam, completedAt: at("2026-11-01"), completedBy: sam }),
  chore("Clean gutters", { dueDate: "2026-10-14" }),
];
const december = [chore("Hang lights", { dueDate: "2026-12-01", assignee: sam })];
const everything = [...october, ...november, ...december];

function renderHistory() {
  render(<HouseholdChoreHistory household={household} userId="u-ana" />);
}

async function openMonthlyView() {
  renderHistory();
  await userEvent.click(screen.getByRole("radio", { name: "Monthly" }));
}

const list = () => screen.findByRole("list", { name: "Chores this month" });
const cards = (element: HTMLElement) => within(element).getAllByRole("listitem");
// Each row is a button whose first part is the chore's name.
const names = (element: HTMLElement) => cards(element).map((item) => item.querySelector("button")?.firstChild?.textContent);
const card = (element: HTMLElement, name: string) => cards(element).find((item) => within(item).queryByText(name))!;

/** A row's lines: first the due date and what happened, then who the chore is for. */
function lines(element: HTMLElement, name: string) {
  const button = within(card(element, name)).getByRole("button");
  const described = document.getElementById(button.getAttribute("aria-describedby")!)!;
  return Array.from(described.children, (line) => line.textContent);
}

/** The summary's numbers by label, for example { Completed: 2, Incomplete: 2, Overdue: 1 }. */
function summary() {
  const region = screen.getByRole("region", { name: "Monthly chore summary" });
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
  listChores.mockResolvedValue({ ok: true, chores: everything });
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("Household chore history, monthly view", { tags: ["SCRUM-47"] }, () => {
  it("AC1: the monthly view lists the current month's chores with name, housemate, due date, status and completion date", async () => {
    await openMonthlyView();

    const chores = await list();
    expect(screen.getByText("November 2026")).toBeInTheDocument();
    expect(screen.getByText("Current month")).toBeInTheDocument();
    expect(listChores).toHaveBeenLastCalledWith("2026-11-01");
    // Only chores due in November, latest due first.
    expect(names(chores)).toEqual(["Buy dish soap", "Take out trash", "Mop kitchen", "Wash dishes"]);

    expect(lines(chores, "Wash dishes")).toEqual(["Due Thu, Nov 5 · Done Wed, Nov 4", "You"]);
    expect(lines(chores, "Mop kitchen")).toEqual(["Due Fri, Nov 6 · Done Sun, Nov 8", "Sam Ito"]);
    expect(lines(chores, "Take out trash")).toEqual(["Due Tue, Nov 10 · Not done yet", "Sam Ito"]);
    expect(lines(chores, "Buy dish soap")).toEqual(["Due Fri, Nov 20 · Not done yet", "You"]);
    // Completion status: Done, Late (done after the due date) and Overdue chips; to do has none.
    expect(within(card(chores, "Wash dishes")).getByText("Done")).toBeInTheDocument();
    expect(within(card(chores, "Mop kitchen")).getByText("Late")).toBeInTheDocument();
    expect(within(card(chores, "Take out trash")).getByText("Overdue")).toBeInTheDocument();
  });

  it("AC2: going to a previous month shows that month's chores", async () => {
    await openMonthlyView();
    await list();

    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));

    expect(await screen.findByText("October 2026")).toBeInTheDocument();
    expect(screen.queryByText("Current month")).not.toBeInTheDocument();
    expect(listChores).toHaveBeenLastCalledWith("2026-10-01");
    const chores = await list();
    expect(names(chores)).toEqual(["Rake leaves", "Clean gutters"]);
    // Due in October, so it stays in October even though it was done on Nov 1.
    expect(lines(chores, "Rake leaves")).toEqual(["Due Sat, Oct 31 · Done Sun, Nov 1", "Sam Ito"]);

    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(await screen.findByText("November 2026")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(await screen.findByText("September 2026")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Go to current month" }));
    expect(await screen.findByText("November 2026")).toBeInTheDocument();
  });

  it("AC3: the summary counts the selected month's completed, incomplete and overdue chores", async () => {
    await openMonthlyView();
    await list();

    // November: 2 done (one late), 2 not done, 1 of those past due.
    expect(summary()).toEqual({ Completed: 2, Incomplete: 2, Overdue: 1 });

    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    await screen.findByText("October 2026");
    await list();

    expect(summary()).toEqual({ Completed: 1, Incomplete: 1, Overdue: 1 });
  });

  it("AC4: selecting a chore opens its details and description", async () => {
    getChoreHistory.mockResolvedValue({ ok: true, chore: november[0], history: [] });
    await openMonthlyView();

    await userEvent.click(within(await list()).getByRole("button", { name: "View history for Wash dishes" }));

    expect(getChoreHistory).toHaveBeenCalledWith("Wash dishes");
    expect(await screen.findByRole("heading", { name: "Wash dishes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chore details" })).toBeInTheDocument();
    expect(screen.getByText("Hand-wash the knives")).toBeInTheDocument();
    // Ana is signed in, so the chore's assignee shows as "You" (README Conflicts row 3).
    expect(screen.getByText("Assigned to").nextElementSibling).toHaveTextContent("You");
  });

  it("AC5: a month with no chores says so", async () => {
    await openMonthlyView();
    await list();

    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));

    expect(await screen.findByText("September 2026")).toBeInTheDocument();
    expect(await screen.findByText("No chores this month.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Chores this month" })).not.toBeInTheDocument();
  });

  it("AC6: a failed load shows an error with a way to retry", async () => {
    renderHistory();
    await screen.findByRole("region", { name: "Weekly chore summary" });
    listChores.mockResolvedValueOnce({ ok: false, code: "NETWORK_ERROR" });

    await userEvent.click(screen.getByRole("radio", { name: "Monthly" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load household chore history.");
    expect(screen.queryByRole("list", { name: "Chores this month" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(names(await list())).toEqual(["Buy dish soap", "Take out trash", "Mop kitchen", "Wash dishes"]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("opens on the weekly view, and switching back shows it again", async () => {
    renderHistory();

    expect(screen.getByRole("radio", { name: "Weekly" })).toBeChecked();
    expect(await screen.findByRole("region", { name: "Weekly chore summary" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Monthly" }));
    await list();
    expect(screen.queryByRole("region", { name: "Weekly chore summary" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Weekly" }));
    expect(await screen.findByRole("region", { name: "Weekly chore summary" })).toBeInTheDocument();
  });
});
