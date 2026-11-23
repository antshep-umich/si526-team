// SCRUM-73 Schedule Page: the household's chores by day, a week or a month at a time.
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Household } from "../api/households.ts";
import { forgetChoreFilter } from "../choreFilter.ts";
import type { Chore } from "../chores.ts";
import { startingSpot, type ScheduleSpot } from "../schedule.ts";
import { POLL_INTERVAL_MS } from "../usePolling.ts";
import Home from "./Home.tsx";
import Schedule from "./Schedule.tsx";

const { listChores, completeChore, undoChore } = vi.hoisted(() => ({
  listChores: vi.fn(),
  completeChore: vi.fn(),
  undoChore: vi.fn(),
}));
vi.mock("../api/chores.ts", () => ({ listChores, completeChore, undoChore }));

const household: Household = {
  id: "h1",
  name: "Maple St House",
  inviteCode: "K7Q2MXAB",
  assignmentMethod: null,
  createdAt: "2026-10-17T00:00:00.000Z",
  role: "owner",
  members: [],
};

// Thursday, Oct 29 2026, noon on the phone: the week of the story's example, "Oct 26 to Nov 1".
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
    createdBy: ana,
    createdAt: at("2026-10-20"),
    completedAt: null,
    completedBy: null,
    ...fields,
  };
}

const chores = [
  chore("Take out trash", { dueDate: "2026-10-27", assignee: sam }), // overdue
  chore("Wash dishes", { dueDate: "2026-10-27", completedAt: at("2026-10-27"), completedBy: ana }),
  chore("Clean bathroom"), // today, Ana's
  chore("Buy dish soap", { dueDate: "2026-10-30", assignee: sam }),
  chore("Mop floors", { dueDate: "2026-11-04", assignee: sam }), // next week
];

/** The Schedule with App's part played: it keeps the Schedule's place. */
function renderSchedule(start: ScheduleSpot = startingSpot("2026-10-29")) {
  const callbacks = { onEditChore: vi.fn(), onOpenChore: vi.fn() };
  function Harness() {
    const [spot, setSpot] = useState(start);
    return <Schedule household={household} userId="u-ana" spot={spot} onSpotChange={setSpot} {...callbacks} />;
  }
  render(<Harness />);
  return callbacks;
}

const range = () => screen.getByRole("heading", { level: 2, name: /to|20\d\d/ });
const days = () => within(screen.getByRole("list", { name: /^Days of the/ })).getAllByRole("button");
const day = (name: RegExp) => screen.getByRole("button", { name });
const selectedDay = () => days().find((button) => button.getAttribute("aria-pressed") === "true");
const dayList = () => screen.queryByRole("list", { name: "Chores on this day" });
const cardNames = () =>
  within(dayList()!)
    .getAllByRole("listitem")
    .map((item) => item.querySelector(".name")?.textContent);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  listChores.mockResolvedValue({ ok: true, chores });
  forgetChoreFilter();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Schedule page", { tags: ["SCRUM-73"] }, () => {
  it("AC1: opens on the current week with Week selected, today highlighted, and the date range in the header", async () => {
    renderSchedule();

    expect(screen.getByRole("heading", { level: 1, name: "Schedule" })).toBeInTheDocument();
    await screen.findByRole("list", { name: "Days of the week" });
    expect(screen.getByRole("radio", { name: "Week" })).toBeChecked();
    expect(range()).toHaveTextContent("Oct 26 to Nov 1");
    const today = day(/^Thursday, Oct 29 \(today\)/);
    expect(today).toHaveAttribute("aria-current", "date");
    expect(today).toHaveClass("isToday");
    expect(selectedDay()).toBe(today);
    expect(listChores).toHaveBeenCalledWith("2026-10-26");
  });

  it("AC2: the week strip shows seven days, each with the chores due that day, and marks a day with an overdue chore", async () => {
    renderSchedule();
    await screen.findByRole("list", { name: "Days of the week" });

    expect(days().map((button) => button.getAttribute("aria-label"))).toEqual([
      "Monday, Oct 26: no chores",
      "Tuesday, Oct 27: 2 chores, overdue",
      "Wednesday, Oct 28: no chores",
      "Thursday, Oct 29 (today): 1 chore",
      "Friday, Oct 30: 1 chore",
      "Saturday, Oct 31: no chores",
      "Sunday, Nov 1: no chores",
    ]);
    const tuesday = day(/^Tuesday/);
    expect(tuesday).toHaveTextContent(/^T272$/);
    expect(tuesday.querySelector(".overdueDot")).not.toBeNull();
    expect(day(/^Friday/).querySelector(".overdueDot")).toBeNull();
  });

  it("AC3: selecting a day lists its chores under the strip on the Chore List's cards: name, housemate (\"You\" for the user) and status", async () => {
    renderSchedule();
    await userEvent.click(await screen.findByRole("button", { name: /^Tuesday/ }));

    expect(screen.getByRole("heading", { level: 2, name: "Tuesday, Oct 27" })).toBeInTheDocument();
    expect(cardNames()).toEqual(["Take out trash", "Wash dishes"]);
    const trash = within(dayList()!).getAllByRole("listitem")[0]!;
    expect(trash).toHaveTextContent("Sam Ito · due Tue, Oct 27");
    expect(within(trash.querySelector<HTMLElement>(".row")!).getByText("Overdue")).toBeInTheDocument();
    const dishes = within(dayList()!).getAllByRole("listitem")[1]!;
    expect(dishes).toHaveTextContent("You · done Tue, Oct 27");
    expect(within(dishes.querySelector<HTMLElement>(".row")!).getByText("Done")).toBeInTheDocument();
    // Ana's own chore has its checkbox, as on the Chore List; Sam's doesn't.
    expect(within(dishes).getByRole("checkbox", { name: "Mark Wash dishes not done" })).toBeChecked();
    expect(within(trash).queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("AC4: the previous and next arrows show the previous or next week", async () => {
    renderSchedule();
    await screen.findByRole("list", { name: "Days of the week" });

    await userEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(range()).toHaveTextContent("Nov 2 to Nov 8");
    expect(selectedDay()).toHaveAccessibleName(/^Monday, Nov 2/);
    expect(day(/^Wednesday, Nov 4/)).toHaveAccessibleName("Wednesday, Nov 4: 1 chore");

    await userEvent.click(screen.getByRole("button", { name: "Previous week" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous week" }));
    expect(range()).toHaveTextContent("Oct 19 to Oct 25");
    // An earlier week loads its done chores too.
    expect(listChores).toHaveBeenLastCalledWith("2026-10-19");
  });

  it("AC5: Today opens the current week with today selected", async () => {
    renderSchedule();
    await screen.findByRole("list", { name: "Days of the week" });
    await userEvent.click(screen.getByRole("button", { name: "Next week" }));
    await userEvent.click(screen.getByRole("button", { name: "Next week" }));

    await userEvent.click(screen.getByRole("button", { name: "Today" }));

    expect(range()).toHaveTextContent("Oct 26 to Nov 1");
    expect(selectedDay()).toHaveAccessibleName(/^Thursday, Oct 29 \(today\)/);
  });

  it("AC6: Month opens the month as a calendar, with the same counts, arrows and Today", async () => {
    renderSchedule();
    await screen.findByRole("list", { name: "Days of the week" });

    await userEvent.click(screen.getByRole("radio", { name: "Month" }));

    expect(range()).toHaveTextContent("October 2026");
    expect(days()).toHaveLength(31);
    expect(day(/^Tuesday, Oct 27/)).toHaveAccessibleName("Tuesday, Oct 27: 2 chores, overdue");
    expect(selectedDay()).toHaveAccessibleName(/^Thursday, Oct 29/);
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(range()).toHaveTextContent("November 2026");
    expect(day(/^Wednesday, Nov 4/)).toHaveAccessibleName("Wednesday, Nov 4: 1 chore");
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(range()).toHaveTextContent("October 2026");
  });

  it("AC7: Mine shows only the user's chores, and the filter is the Chore List's", async () => {
    renderSchedule();
    await screen.findByRole("list", { name: "Days of the week" });

    await userEvent.click(screen.getByRole("radio", { name: "Mine" }));

    expect(day(/^Tuesday/)).toHaveAccessibleName("Tuesday, Oct 27: 1 chore");
    expect(day(/^Friday/)).toHaveAccessibleName("Friday, Oct 30: no chores");
    expect(cardNames()).toEqual(["Clean bathroom"]);
    await userEvent.click(screen.getByRole("radio", { name: "All" }));
    expect(cardNames()).toEqual(["Take out trash", "Clean bathroom"]);

    // The same choice on the Chore List.
    await userEvent.click(screen.getByRole("radio", { name: "Mine" }));
    render(<Home household={household} userId="u-ana" onAddChore={vi.fn()} onEditChore={vi.fn()} onOpenChore={vi.fn()} />);
    expect(screen.getAllByRole("radio", { name: "Mine" })[1]).toBeChecked();
  });

  it("AC8: selecting a chore opens its details, with its history and, for those who may, Edit", async () => {
    const { onEditChore, onOpenChore } = renderSchedule();
    const name = await screen.findByRole("button", { name: /^Clean bathroom/ });

    await userEvent.click(name);

    expect(name).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(name.getAttribute("aria-controls")!)!;
    expect(panel).toHaveTextContent("Assigned To:You");
    await userEvent.click(within(panel).getByRole("button", { name: "Edit Clean bathroom" }));
    expect(onEditChore).toHaveBeenCalledWith(expect.objectContaining({ id: "Clean bathroom" }));
    await userEvent.click(within(panel).getByRole("button", { name: "View history for Clean bathroom" }));
    expect(onOpenChore).toHaveBeenCalledWith("Clean bathroom");
  });

  it("AC10: a day with no chores says “No chores on this day.”", async () => {
    renderSchedule();
    await userEvent.click(await screen.findByRole("button", { name: /^Wednesday/ }));

    expect(screen.getByText("No chores on this day.")).toBeInTheDocument();
    expect(dayList()).not.toBeInTheDocument();
  });

  it("AC11: when the schedule fails to load it says so, with a Retry button that loads it again", async () => {
    listChores.mockResolvedValueOnce({ ok: false, code: "NETWORK_ERROR" });
    renderSchedule();

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn’t load the schedule. Please try again.");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("list", { name: "Days of the week" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Schedule: the team's decisions and the feasibility check", () => {
  it("lists chores still overdue from earlier days first under today, without counting them for today", async () => {
    renderSchedule();
    await screen.findByRole("list", { name: "Days of the week" });

    expect(cardNames()).toEqual(["Take out trash", "Clean bathroom"]);
    expect(day(/^Thursday/)).toHaveAccessibleName("Thursday, Oct 29 (today): 1 chore");
  });

  it("marks a chore done from the Schedule, and the day's count stays", async () => {
    completeChore.mockResolvedValue({ ok: true, chore: chore("Clean bathroom", { completedAt: at("2026-10-29", 12), completedBy: ana }) });
    renderSchedule();
    await userEvent.click(await screen.findByRole("checkbox", { name: "Mark Clean bathroom done" }));

    expect(completeChore).toHaveBeenCalledWith("Clean bathroom");
    expect(await screen.findByRole("checkbox", { name: "Mark Clean bathroom not done" })).toBeChecked();
    expect(day(/^Thursday/)).toHaveAccessibleName("Thursday, Oct 29 (today): 1 chore");
  });

  it("updates without a manual refresh when a housemate adds a chore", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(NOW);
    renderSchedule();
    await act(async () => {}); // the first load
    expect(day(/^Saturday/)).toHaveAccessibleName("Saturday, Oct 31: no chores");

    listChores.mockResolvedValue({ ok: true, chores: [...chores, chore("Water plants", { dueDate: "2026-10-31" })] });
    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
    });

    expect(day(/^Saturday/)).toHaveAccessibleName("Saturday, Oct 31: 1 chore");
  });
});
