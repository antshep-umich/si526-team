// The chore list (SCRUM-7 and SCRUM-8) and its header menu (SCRUM-3).
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Household } from "../api/households.ts";
import type { Chore } from "../chores.ts";
import Home, { forgetChoreFilter } from "./Home.tsx";

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
  createdAt: "2026-10-17T00:00:00.000Z",
  role: "owner",
  members: [],
};

// Thursday, Oct 29 2026, noon on the phone. The week started Monday Oct 26.
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
  chore("Buy dish soap", { dueDate: "2026-10-30", assignee: sam }),
  chore("Clean bathroom"),
  chore("Take out trash", { dueDate: "2026-10-27", assignee: sam }),
  chore("Wash dishes", { dueDate: "2026-10-28", completedAt: at("2026-10-28"), completedBy: ana }),
];

function renderHome(props: Partial<Parameters<typeof Home>[0]> = {}) {
  const callbacks = { onAddChore: vi.fn(), onLogOut: vi.fn() };
  render(<Home household={household} userId="u-ana" {...callbacks} {...props} />);
  return callbacks;
}

/** The names on the cards in a list, in order. */
const names = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((item) => item.querySelector("p")?.textContent);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  listChores.mockResolvedValue({ ok: true, chores });
  forgetChoreFilter();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Home chore list", () => {
  it("shows a loading indicator, then the week's progress and the chores to do, overdue first", async () => {
    renderHome();

    expect(screen.getByRole("status")).toHaveTextContent("Loading chores…");
    const open = await screen.findByRole("list", { name: "Chores to do" });

    expect(listChores).toHaveBeenCalledWith("2026-10-26");
    expect(screen.getByRole("heading", { name: "Maple St House" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "1 of 4 chores done" })).toBeInTheDocument();
    expect(names(open)).toEqual(["Take out trash", "Clean bathroom", "Buy dish soap"]);
    expect(within(open).getByText("Sam Ito · due Tue, Oct 27")).toBeInTheDocument();
    expect(within(open).getByText("Overdue")).toBeInTheDocument();
    expect(within(open).getByText("You · due today")).toBeInTheDocument();
  });

  it("gives only the assignee a checkbox (SCRUM-8)", async () => {
    renderHome();
    await screen.findByRole("list", { name: "Chores to do" });

    expect(screen.getByRole("checkbox", { name: "Mark Clean bathroom done" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Mark Buy dish soap done" })).not.toBeInTheDocument();
  });

  it("keeps done chores in a collapsed Done section that shows when they were done", async () => {
    renderHome();
    const toggle = await screen.findByRole("button", { name: "Done (1)" });
    const done = document.getElementById(toggle.getAttribute("aria-controls")!)!;

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(done).not.toBeVisible();

    await userEvent.click(toggle);

    expect(done).toBeVisible();
    expect(within(done).getByText("You · done Wed, Oct 28 · due Wed, Oct 28")).toBeInTheDocument();
    expect(within(done).getByText("Done")).toBeInTheDocument();
  });

  it("marks a chore done: it moves to the Done section and is saved", async () => {
    completeChore.mockResolvedValue({
      ok: true,
      chore: chore("Clean bathroom", { completedAt: NOW.toISOString(), completedBy: ana }),
    });
    renderHome();

    await userEvent.click(await screen.findByRole("checkbox", { name: "Mark Clean bathroom done" }));

    expect(completeChore).toHaveBeenCalledWith("Clean bathroom");
    expect(names(screen.getByRole("list", { name: "Chores to do" }))).toEqual(["Take out trash", "Buy dish soap"]);
    expect(screen.getByRole("button", { name: "Done (2)" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "2 of 4 chores done" })).toBeInTheDocument();
  });

  it("undoes a done chore from the Done section", async () => {
    undoChore.mockResolvedValue({ ok: true, chore: chore("Wash dishes", { dueDate: "2026-10-28" }) });
    renderHome();

    await userEvent.click(await screen.findByRole("button", { name: "Done (1)" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Mark Wash dishes not done" }));

    expect(undoChore).toHaveBeenCalledWith("Wash dishes");
    const open = screen.getByRole("list", { name: "Chores to do" });
    expect(names(open)).toEqual(["Take out trash", "Wash dishes", "Clean bathroom", "Buy dish soap"]);
    expect(screen.queryByRole("button", { name: /^Done/ })).not.toBeInTheDocument();
  });

  it("puts the checkbox back and says so when saving fails", async () => {
    completeChore.mockResolvedValue({ ok: false, code: "NETWORK_ERROR" });
    renderHome();

    await userEvent.click(await screen.findByRole("checkbox", { name: "Mark Clean bathroom done" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't update this chore. Please try again.");
    expect(screen.getByRole("checkbox", { name: "Mark Clean bathroom done" })).not.toBeChecked();
  });

  it("shows only the user's chores under Mine, and remembers it until log out", async () => {
    const { unmount } = render(<Home household={household} userId="u-ana" onAddChore={() => {}} onLogOut={() => {}} />);

    await userEvent.click(await screen.findByRole("radio", { name: "Mine" }));

    expect(names(screen.getByRole("list", { name: "Chores to do" }))).toEqual(["Clean bathroom"]);
    // The progress card is still the whole household's week.
    expect(screen.getByRole("progressbar", { name: "1 of 4 chores done" })).toBeInTheDocument();

    unmount();
    renderHome();
    expect(await screen.findByRole("radio", { name: "Mine" })).toBeChecked();
  });

  it("starts on All again after forgetChoreFilter (log out)", async () => {
    sessionStorage.setItem("jaals.choreFilter", "mine");
    forgetChoreFilter();
    renderHome();

    expect(await screen.findByRole("radio", { name: "All" })).toBeChecked();
  });

  it.each([
    ["All", [], "No chores yet. Add the first one."],
    ["Mine", [chore("Buy dish soap", { assignee: sam })], "Nothing assigned to you right now."],
  ])("shows the empty state for %s", async (filter, list, message) => {
    listChores.mockResolvedValue({ ok: true, chores: list });
    renderHome();

    await userEvent.click(await screen.findByRole("radio", { name: filter }));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("shows No Chores Yet on the progress card when nothing is due this week", async () => {
    listChores.mockResolvedValue({ ok: true, chores: [] });
    renderHome();

    expect(await screen.findByText("No Chores Yet")).toBeInTheDocument();
  });

  it("offers Try again when the chores don't load", async () => {
    listChores.mockResolvedValueOnce({ ok: false, code: "NETWORK_ERROR" });
    renderHome();

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load chores.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("list", { name: "Chores to do" })).toBeInTheDocument();
    expect(listChores).toHaveBeenCalledTimes(2);
  });

  it("opens Add chore", async () => {
    const { onAddChore } = renderHome();

    await userEvent.click(screen.getByRole("button", { name: "Add chore" }));

    expect(onAddChore).toHaveBeenCalledTimes(1);
  });

  it("shows the tab bar with Chores selected", async () => {
    renderHome();

    expect(screen.getByRole("button", { name: "Chores" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Schedule" })).toHaveAttribute("aria-disabled", "true");
    await screen.findByRole("list", { name: "Chores to do" });
  });
});

describe("Home menu", () => {
  it("starts closed", async () => {
    renderHome();

    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await screen.findByRole("list", { name: "Chores to do" });
  });

  it("opens with Log out as a primary button, focused", async () => {
    renderHome();

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));

    const logOut = screen.getByRole("menuitem", { name: "Log out" });
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "true");
    expect(logOut).toHaveClass("button", "primary");
    expect(logOut).toHaveFocus();
  });

  it("logs out", async () => {
    const { onLogOut } = renderHome();

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(onLogOut).toHaveBeenCalledTimes(1);
  });

  it("closes with Escape, a tap outside, or the menu button again", async () => {
    renderHome();
    const menuButton = screen.getByRole("button", { name: "Menu" });

    await userEvent.click(menuButton);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(menuButton);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Add chore" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(menuButton);
    await userEvent.click(menuButton);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
