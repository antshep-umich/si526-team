// The chore list (SCRUM-7 and SCRUM-8) and its header menu (SCRUM-3).
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Household } from "../api/households.ts";
import type { Chore } from "../chores.ts";
import Home, { forgetChoreFilter } from "./Home.tsx";
import { MenuProvider } from "./HouseholdMenu.tsx";

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
  const callbacks = {
    onAddChore: vi.fn(),
    onOpenChore: vi.fn(),
    onChoreHistory: vi.fn(),
    onHouseholdChoreHistory: vi.fn(),
    onLogOut: vi.fn(),
  };
  const { onAddChore, onOpenChore, ...menu } = callbacks;
  render(
    <MenuProvider actions={menu}>
      <Home household={household} userId="u-ana" onAddChore={onAddChore} onOpenChore={onOpenChore} {...props} />
    </MenuProvider>,
  );
  return callbacks;
}

/** The names on the cards in a list, in order. */
const names = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((item) => item.querySelector("p")?.textContent);

/** The card for a chore, found by its name. */
const card = (name: string) => screen.getByText(name).closest("li")!;

const openList = () => screen.getByRole("list", { name: "Chores to do" });

/** Opens the Done section and returns its list. */
async function openDone() {
  const toggle = screen.getByRole("button", { name: /^Done \(/ });
  if (toggle.getAttribute("aria-expanded") === "false") await userEvent.click(toggle);
  return document.getElementById(toggle.getAttribute("aria-controls")!)!;
}

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
  it("shows a loading indicator, then the chores to do with overdue ones first", async () => {
    renderHome();

    expect(screen.getByRole("status")).toHaveTextContent("Loading chores…");
    const open = await screen.findByRole("list", { name: "Chores to do" });

    expect(listChores).toHaveBeenCalledWith("2026-10-26");
    expect(names(open)).toEqual(["Take out trash", "Clean bathroom", "Buy dish soap"]);
  });

  it("remembers Mine until log out", async () => {
    const { unmount } = render(
      <Home
        household={household}
        userId="u-ana"
        onAddChore={() => {}}
        onOpenChore={() => {}}
      />,
    );
    await userEvent.click(await screen.findByRole("radio", { name: "Mine" }));

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

  it("keeps counting the whole household's week under Mine", async () => {
    renderHome();

    await userEvent.click(await screen.findByRole("radio", { name: "Mine" }));

    expect(screen.getByRole("progressbar", { name: "1 of 4 chores done" })).toBeInTheDocument();
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

  it("asks App to open Add chore", async () => {
    const { onAddChore } = renderHome();

    await userEvent.click(screen.getByRole("button", { name: "Add chore" }));

    expect(onAddChore).toHaveBeenCalledTimes(1);
  });
});

describe("SCRUM-7 acceptance criteria", { tags: ["SCRUM-7"] }, () => {
  // The Chores tab itself is around every screen (TabLayout), so App.test.tsx checks it.
  it('AC1: opens with the household name in the header and "All" selected', async () => {
    renderHome();
    await screen.findByRole("list", { name: "Chores to do" });

    expect(screen.getByRole("heading", { level: 1, name: "Maple St House" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "All" })).toBeChecked();
  });

  it.each([
    ["On track", chores, "1 of 4 chores done", "On track"],
    [
      "Complete!",
      [chore("Wash dishes", { completedAt: at("2026-10-29"), completedBy: ana })],
      "1 of 1 chores done",
      "Complete!",
    ],
    [
      "{num} Late",
      [...chores, chore("Water plants", { dueDate: "2026-10-26", completedAt: at("2026-10-27"), completedBy: ana })],
      "2 of 5 chores done",
      "1 Late",
    ],
  ])('AC2: the progress card shows "[X] of [Y] chores done", a progress bar and the %s label', async (_label, list, count, status) => {
    listChores.mockResolvedValue({ ok: true, chores: list });
    renderHome();

    expect(await screen.findByRole("progressbar", { name: count })).toBeInTheDocument();
    expect(screen.getByText(count)).toBeInTheDocument();
    expect(screen.getByText(status)).toBeInTheDocument();
  });

  it('AC2: the progress card says "No Chores Yet" when no chores are due', async () => {
    listChores.mockResolvedValue({ ok: true, chores: [] });
    renderHome();

    expect(await screen.findByText("No Chores Yet")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it('AC3: each open card shows the name, the housemate ("You" for the user), the due date, and a checkbox only on the user\'s own', async () => {
    renderHome();
    await screen.findByRole("list", { name: "Chores to do" });

    const mine = within(card("Clean bathroom"));
    expect(mine.getByText("You · due today")).toBeInTheDocument();
    expect(mine.getByRole("checkbox", { name: "Mark Clean bathroom done" })).toBeInTheDocument();

    const sams = within(card("Buy dish soap"));
    expect(sams.getByText("Sam Ito · due tomorrow")).toBeInTheDocument();
    expect(sams.queryByRole("checkbox")).not.toBeInTheDocument();

    expect(within(card("Take out trash")).getByText("Sam Ito · due Tue, Oct 27")).toBeInTheDocument();
  });

  it('AC4: a chore past its due date is highlighted and has an "Overdue" chip', async () => {
    renderHome();
    await screen.findByRole("list", { name: "Chores to do" });

    const overdue = card("Take out trash");
    expect(overdue.firstElementChild).toHaveClass("overdue");
    expect(within(overdue).getByText("Overdue")).toBeInTheDocument();
    expect(card("Clean bathroom").firstElementChild).not.toHaveClass("overdue");
    expect(within(card("Clean bathroom")).queryByText("Overdue")).not.toBeInTheDocument();
  });

  it('AC5: "Mine" shows only the chores assigned to the user', async () => {
    renderHome();

    await userEvent.click(await screen.findByRole("radio", { name: "Mine" }));

    expect(names(openList())).toEqual(["Clean bathroom"]);
    expect(names(await openDone())).toEqual(["Wash dishes"]);
  });

  it('AC6: "All" shows every household chore again', async () => {
    renderHome();
    await userEvent.click(await screen.findByRole("radio", { name: "Mine" }));

    await userEvent.click(screen.getByRole("radio", { name: "All" }));

    expect(names(openList())).toEqual(["Take out trash", "Clean bathroom", "Buy dish soap"]);
  });

  it('AC7: done chores sit under "Done ([count])" below the open ones, struck through, with a "Done" or "Late" chip', async () => {
    listChores.mockResolvedValue({
      ok: true,
      chores: [...chores, chore("Water plants", { dueDate: "2026-10-26", completedAt: at("2026-10-27"), completedBy: ana })],
    });
    renderHome();
    await screen.findByRole("list", { name: "Chores to do" });

    const toggle = screen.getByRole("button", { name: "Done (2)" });
    expect(openList().compareDocumentPosition(toggle)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    const done = await openDone();
    expect(names(done)).toEqual(["Wash dishes", "Water plants"]); // most recently done first
    for (const name of ["Water plants", "Wash dishes"]) {
      expect(within(done).getByText(name)).toHaveStyle({ textDecoration: "line-through" });
    }
    expect(within(card("Wash dishes")).getByText("Done")).toBeInTheDocument();
    expect(within(card("Water plants")).getByText("Late")).toBeInTheDocument();
  });

  it('AC8: "Done ([count])" opens and closes the section', async () => {
    renderHome();
    const toggle = await screen.findByRole("button", { name: "Done (1)" });
    const done = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(done).not.toBeVisible();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(done).toBeVisible();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(done).not.toBeVisible();
  });

  it('AC10: says "Couldn\'t load chores." with a "Try again" button when they fail to load', async () => {
    listChores.mockResolvedValueOnce({ ok: false, code: "NETWORK_ERROR" });
    renderHome();

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load chores.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("list", { name: "Chores to do" })).toBeInTheDocument();
    expect(listChores).toHaveBeenCalledTimes(2);
  });
});

describe("SCRUM-8 acceptance criteria", { tags: ["SCRUM-8"] }, () => {
  it('AC1: ticking an open chore moves it to "Done", struck through with a "Done" chip, and updates the count and progress', async () => {
    completeChore.mockResolvedValue({
      ok: true,
      chore: chore("Clean bathroom", { completedAt: NOW.toISOString(), completedBy: ana }),
    });
    renderHome();

    await userEvent.click(await screen.findByRole("checkbox", { name: "Mark Clean bathroom done" }));

    expect(completeChore).toHaveBeenCalledWith("Clean bathroom");
    expect(names(openList())).toEqual(["Take out trash", "Buy dish soap"]);
    expect(screen.getByRole("button", { name: "Done (2)" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "2 of 4 chores done" })).toBeInTheDocument();
    const done = await openDone();
    expect(within(done).getByText("Clean bathroom")).toHaveStyle({ textDecoration: "line-through" });
    expect(within(card("Clean bathroom")).getByText("Done")).toBeInTheDocument();
  });

  it('AC1: an overdue chore ticked off gets the "Late" chip', async () => {
    const overdue = chore("Fold laundry", { dueDate: "2026-10-27" });
    listChores.mockResolvedValue({ ok: true, chores: [overdue] });
    completeChore.mockResolvedValue({ ok: true, chore: { ...overdue, completedAt: NOW.toISOString(), completedBy: ana } });
    renderHome();

    await userEvent.click(await screen.findByRole("checkbox", { name: "Mark Fold laundry done" }));
    await openDone();

    expect(within(card("Fold laundry")).getByText("Late")).toBeInTheDocument();
  });

  it("AC2: unticking a done chore returns it to the open list and updates the count and progress", async () => {
    undoChore.mockResolvedValue({ ok: true, chore: chore("Wash dishes", { dueDate: "2026-10-28" }) });
    listChores.mockResolvedValue({ ok: true, chores: [...chores, chore("Mop", { completedAt: at("2026-10-29"), completedBy: ana })] });
    renderHome();
    await screen.findByRole("button", { name: "Done (2)" });
    expect(screen.getByRole("progressbar", { name: "2 of 5 chores done" })).toBeInTheDocument();
    await openDone();

    await userEvent.click(screen.getByRole("checkbox", { name: "Mark Wash dishes not done" }));

    expect(undoChore).toHaveBeenCalledWith("Wash dishes");
    expect(names(openList())).toContain("Wash dishes");
    expect(screen.getByRole("button", { name: "Done (1)" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "1 of 5 chores done" })).toBeInTheDocument();
  });

  it("AC3: when the change fails to save, the chore goes back and the error shows", async () => {
    completeChore.mockResolvedValue({ ok: false, code: "NETWORK_ERROR" });
    renderHome();

    await userEvent.click(await screen.findByRole("checkbox", { name: "Mark Clean bathroom done" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't update this chore. Please try again.");
    expect(screen.getByRole("checkbox", { name: "Mark Clean bathroom done" })).not.toBeChecked();
    expect(names(openList())).toContain("Clean bathroom");
    expect(screen.getByRole("button", { name: "Done (1)" })).toBeInTheDocument();
  });

  it("AC5: only the assignee gets a checkbox, on open and done chores alike", async () => {
    listChores.mockResolvedValue({
      ok: true,
      chores: [...chores, chore("Vacuum", { assignee: sam, completedAt: at("2026-10-28"), completedBy: sam })],
    });
    renderHome();
    await screen.findByRole("list", { name: "Chores to do" });
    await openDone();

    expect(within(card("Clean bathroom")).getByRole("checkbox")).toBeInTheDocument();
    expect(within(card("Wash dishes")).getByRole("checkbox")).toBeInTheDocument();
    for (const sams of ["Buy dish soap", "Take out trash", "Vacuum"]) {
      expect(within(card(sams)).queryByRole("checkbox")).not.toBeInTheDocument();
    }
  });
});

// The menu is on every screen in a household (HouseholdMenu.tsx); Home is where it started.
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

  it("opens My chore history (SCRUM-44)", async () => {
    const { onChoreHistory } = renderHome();

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "My chore history" }));

    expect(onChoreHistory).toHaveBeenCalledTimes(1);
  });

  it("opens Household chore history (SCRUM-46)", async () => {
    const { onHouseholdChoreHistory } = renderHome();

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Household chore history" }));

    expect(onHouseholdChoreHistory).toHaveBeenCalledTimes(1);
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
