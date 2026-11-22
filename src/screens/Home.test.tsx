// The chore list (SCRUM-7 and SCRUM-8) and its header menu (SCRUM-3).
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Household } from "../api/households.ts";
import type { Chore } from "../chores.ts";
import { POLL_INTERVAL_MS } from "../usePolling.ts";
import Home, { forgetChoreFilter } from "./Home.tsx";

const { listChores, completeChore, undoChore, getChore } = vi.hoisted(() => ({
  listChores: vi.fn(),
  completeChore: vi.fn(),
  undoChore: vi.fn(),
  getChore: vi.fn(),
}));
vi.mock("../api/chores.ts", () => ({ listChores, completeChore, undoChore, getChore }));

const household: Household = {
  id: "h1",
  name: "Maple St House",
  inviteCode: "K7Q2MXAB",
  assignmentMethod: null,
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
  const callbacks = { onAddChore: vi.fn(), onEditChore: vi.fn(), onOpenChore: vi.fn() };
  render(<Home household={household} userId="u-ana" {...callbacks} {...props} />);
  return callbacks;
}

/** The names on the cards in a list, in order. */
const names = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((item) => item.querySelector(".name")?.textContent);

/** The card for a chore, found by its name. */
const card = (name: string) => screen.getByText(name).closest("li")!;

/** The card's own row (checkbox, name, chip, chevron), without its dropdown. */
const cardRow = (name: string) => card(name).querySelector<HTMLElement>(".row")!;

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
        onEditChore={() => {}}
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

describe("Home chore list, kept current", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(NOW);
  });

  it("shows housemates' changes without a refresh or a Loading message", async () => {
    renderHome();
    await screen.findByRole("list", { name: "Chores to do" });

    listChores.mockResolvedValueOnce({ ok: true, chores: [...chores, chore("Water plants", { assignee: sam })] });
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    expect(names(openList())).toContain("Water plants");
    expect(screen.queryByText("Loading chores…")).not.toBeInTheDocument();
  });

  it("drops a check that started before a tick, so it can't undo it", async () => {
    completeChore.mockResolvedValue({
      ok: true,
      chore: chore("Clean bathroom", { completedAt: NOW.toISOString(), completedBy: ana }),
    });
    renderHome();
    await screen.findByRole("list", { name: "Chores to do" });

    let answerCheck = (_: unknown) => {};
    listChores.mockReturnValueOnce(new Promise((resolve) => (answerCheck = resolve)));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)); // the check starts, with the old list
    await userEvent.click(screen.getByRole("checkbox", { name: "Mark Clean bathroom done" }));
    await act(async () => answerCheck({ ok: true, chores }));

    expect(names(openList())).not.toContain("Clean bathroom");
    expect(screen.getByRole("button", { name: "Done (2)" })).toBeInTheDocument();
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

  it("AC2: the progress bar tracks the chores due this week", async () => {
    listChores.mockResolvedValue({
      ok: true,
      chores: [
        ...chores, // 1 of 4 due this week (Mon Oct 26 to Sun Nov 1) is done
        chore("Sweep porch", { dueDate: "2026-10-22" }), // last week, still open
        chore("Clean oven", { dueDate: "2026-11-03" }), // next week
      ],
    });
    renderHome();

    expect(await screen.findByRole("progressbar", { name: "1 of 4 chores done" })).toBeInTheDocument();
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
    expect(within(overdue.querySelector<HTMLElement>(".row")!).getByText("Overdue")).toBeInTheDocument();
    expect(card("Clean bathroom").firstElementChild).not.toHaveClass("overdue");
    expect(within(cardRow("Clean bathroom")).queryByText("Overdue")).not.toBeInTheDocument();
  });

  it('AC5: an overdue chore that has been completed has a "Late" chip', async () => {
    listChores.mockResolvedValue({
      ok: true,
      chores: [...chores, chore("Water plants", { dueDate: "2026-10-26", completedAt: at("2026-10-27"), completedBy: ana })],
    });
    renderHome();
    await screen.findByRole("list", { name: "Chores to do" });
    await openDone();

    expect(within(cardRow("Water plants")).getByText("Late")).toBeInTheDocument();
    expect(within(cardRow("Water plants")).queryByText("Done")).not.toBeInTheDocument();
    expect(within(cardRow("Wash dishes")).getByText("Done")).toBeInTheDocument();
  });

  it('AC6: "Mine" shows only the chores assigned to the user', async () => {
    renderHome();

    await userEvent.click(await screen.findByRole("radio", { name: "Mine" }));

    expect(names(openList())).toEqual(["Clean bathroom"]);
    expect(names(await openDone())).toEqual(["Wash dishes"]);
  });

  it('AC7: "All" shows every household chore again', async () => {
    renderHome();
    await userEvent.click(await screen.findByRole("radio", { name: "Mine" }));

    await userEvent.click(screen.getByRole("radio", { name: "All" }));

    expect(names(openList())).toEqual(["Take out trash", "Clean bathroom", "Buy dish soap"]);
  });

  it('AC8: done chores sit under "Done ([count])" below the open ones, struck through, with a "Done" chip', async () => {
    listChores.mockResolvedValue({
      ok: true,
      chores: [...chores, chore("Mop", { completedAt: at("2026-10-29"), completedBy: ana })],
    });
    renderHome();
    await screen.findByRole("list", { name: "Chores to do" });

    const toggle = screen.getByRole("button", { name: "Done (2)" });
    expect(openList().compareDocumentPosition(toggle)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    const done = await openDone();
    expect(names(done)).toEqual(["Mop", "Wash dishes"]); // most recently done first
    for (const name of ["Mop", "Wash dishes"]) {
      expect(within(done).getByText(name)).toHaveStyle({ textDecoration: "line-through" });
      expect(within(cardRow(name)).getByText("Done")).toBeInTheDocument();
    }
  });

  it('AC9: "Done ([count])" opens and closes the section', async () => {
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

  it('AC12: says "Couldn\'t load chores." with a "Try again" button when they fail to load', async () => {
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
    expect(within(cardRow("Clean bathroom")).getByText("Done")).toBeInTheDocument();
  });

  it("AC1: a done chore shows the date it was marked done, not the due date", async () => {
    listChores.mockResolvedValue({
      ok: true,
      chores: [chore("Water plants", { dueDate: "2026-10-26", completedAt: at("2026-10-27"), completedBy: ana })],
    });
    renderHome();
    await screen.findByRole("button", { name: "Done (1)" });
    await openDone();

    const meta = card("Water plants").textContent!;
    expect(meta).toMatch(/done Tue, Oct 27/);
    expect(meta).not.toMatch(/due/);
  });

  it('AC1: an overdue chore ticked off gets the "Late" chip', async () => {
    const overdue = chore("Fold laundry", { dueDate: "2026-10-27" });
    listChores.mockResolvedValue({ ok: true, chores: [overdue] });
    completeChore.mockResolvedValue({ ok: true, chore: { ...overdue, completedAt: NOW.toISOString(), completedBy: ana } });
    renderHome();

    await userEvent.click(await screen.findByRole("checkbox", { name: "Mark Fold laundry done" }));
    await openDone();

    expect(within(cardRow("Fold laundry")).getByText("Late")).toBeInTheDocument();
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

describe("Single chore history from the chore list", { tags: ["SCRUM-45"] }, () => {
  it("AC1: the household's chore list shows the household's chores, not only the user's", async () => {
    renderHome();

    expect(names(await screen.findByRole("list", { name: "Chores to do" }))).toEqual([
      "Take out trash",
      "Clean bathroom",
      "Buy dish soap",
    ]);
    expect(names(await openDone())).toEqual(["Wash dishes"]);
  });
});

/** Opens a chore's dropdown from its name and returns the dropdown. */
async function openPanel(name: string) {
  const toggle = await screen.findByRole("button", { name: new RegExp(`^${name}`) });
  await userEvent.click(toggle);
  return document.getElementById(toggle.getAttribute("aria-controls")!)!;
}

/** The dropdown's facts by label, for example { "Assigned To:": "You" }. */
const facts = (panel: HTMLElement) =>
  Object.fromEntries(Array.from(panel.querySelectorAll("dt"), (dt) => [dt.textContent, dt.nextElementSibling?.textContent]));

describe("A chore's dropdown", { tags: ["SCRUM-7"] }, () => {
  it("AC11: the chevron opens a details pane under the card with what the card doesn't show, including when it was last done and by whom", async () => {
    listChores.mockResolvedValue({
      ok: true,
      chores: [chore("Mop", { assignee: sam, completedAt: at("2026-10-28"), completedBy: sam, notes: "Kitchen and hall" })],
    });
    renderHome();
    await screen.findByRole("button", { name: "Done (1)" });
    await openDone();
    const toggle = await screen.findByRole("button", { name: /^Mop/ });
    const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(panel).not.toBeVisible();

    // The chevron to the right of the chip.
    const chevron = card("Mop").querySelector("button[aria-hidden]")!;
    expect(within(cardRow("Mop")).getByText("Done").compareDocumentPosition(chevron)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    await userEvent.click(chevron);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(panel).toBeVisible();
    expect(facts(panel)).toMatchObject({ "Last done:": "Wed, Oct 28 by Sam Ito", "Chore Details:": "Kitchen and hall" });
  });

  it('AC11: the "Edit" pencil shows only for people who may edit the chore, and opens Edit chore', async () => {
    const asMember = { ...household, role: "member" as const };
    listChores.mockResolvedValue({
      ok: true,
      chores: [chore("Clean bathroom"), chore("Buy dish soap", { assignee: sam, createdBy: sam })],
    });
    const { onEditChore } = renderHome({ household: asMember });

    // Ana added "Clean bathroom", so she may edit it; Sam added "Buy dish soap".
    const mine = await openPanel("Clean bathroom");
    const sams = await openPanel("Buy dish soap");
    expect(within(sams).queryByRole("button", { name: "Edit Buy dish soap" })).not.toBeInTheDocument();
    await userEvent.click(within(mine).getByRole("button", { name: "Edit Clean bathroom" }));

    expect(onEditChore).toHaveBeenCalledWith(expect.objectContaining({ id: "Clean bathroom" }));
  });

  it("gives the household owner the pencil on every chore", async () => {
    listChores.mockResolvedValue({ ok: true, chores: [chore("Buy dish soap", { assignee: sam, createdBy: sam })] });
    renderHome();

    const panel = await openPanel("Buy dish soap");

    expect(within(panel).getByRole("button", { name: "Edit Buy dish soap" })).toBeInTheDocument();
  });

  it('has "View history", which opens the chore\'s history', async () => {
    const { onOpenChore } = renderHome();

    const panel = await openPanel("Clean bathroom");
    await userEvent.click(within(panel).getByRole("button", { name: "View history for Clean bathroom" }));

    expect(onOpenChore).toHaveBeenCalledWith("Clean bathroom");
    // Only in the dropdown now, not on the card's row.
    expect(screen.getAllByRole("button", { name: /^View history for/ })).toHaveLength(1);
  });

  it("stays open when the list refreshes", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(NOW);
    renderHome();
    const panel = await openPanel("Clean bathroom");

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    expect(listChores).toHaveBeenCalledTimes(2);
    expect(panel).toBeVisible();
  });
});

describe("Chore details in the dropdown", { tags: ["SCRUM-53"] }, () => {
  it("AC1: selecting a chore in the list shows its name, assigned housemate, due date, completion status and description", async () => {
    listChores.mockResolvedValue({ ok: true, chores: [chore("Clean bathroom", { assignee: sam, notes: "Scrub the tub too" })] });
    renderHome();

    const panel = await openPanel("Clean bathroom");

    expect(within(card("Clean bathroom")).getByText("Clean bathroom")).toBeInTheDocument();
    expect(facts(panel)).toEqual({
      "Assigned To:": "Sam Ito",
      "Due date:": "Thu, Oct 29",
      "Status:": "To do",
      "Chore Details:": "Scrub the tub too",
    });
  });

  it('AC2: a chore with no description shows "No description added."', async () => {
    renderHome();

    const panel = await openPanel("Clean bathroom");

    expect(facts(panel)["Chore Details:"]).toBe("No description added.");
  });

  it("AC5: when the details fail to load (with the list) it shows an error and retries", async () => {
    listChores.mockResolvedValueOnce({ ok: false, code: "NETWORK_ERROR" });
    renderHome();

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load chores.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    const panel = await openPanel("Clean bathroom");
    expect(facts(panel)["Chore Details:"]).toBe("No description added.");
  });

  it("AC3: Back returns to the previous screen: selecting the chore again rolls the details back up, leaving the list as it was", async () => {
    renderHome();
    await userEvent.click(await screen.findByRole("radio", { name: "Mine" }));
    const panel = await openPanel("Clean bathroom");

    await userEvent.click(screen.getByRole("button", { name: /^Clean bathroom/ }));

    expect(panel).not.toBeVisible();
    expect(screen.getByRole("button", { name: /^Clean bathroom/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("radio", { name: "Mine" })).toBeChecked();
    expect(names(openList())).toEqual(["Clean bathroom"]);
  });
});

describe("Chores left by someone who moved out", { tags: ["SCRUM-75"] }, () => {
  it("AC4: their open chores stay on the list marked Unassigned, and any housemate can assign them", async () => {
    const asMember = { ...household, role: "member" as const };
    // Sam added it and has left; Ana is neither its creator nor the owner.
    listChores.mockResolvedValue({ ok: true, chores: [chore("Clean fridge", { assignee: null, createdBy: sam })] });
    const { onEditChore } = renderHome({ household: asMember });

    const open = await screen.findByRole("list", { name: "Chores to do" });
    expect(within(open).getByText("Clean fridge")).toBeInTheDocument();
    expect(cardRow("Clean fridge")).toHaveTextContent("Unassigned");
    // Nobody's to tick off until someone takes it.
    expect(within(card("Clean fridge")).queryByRole("checkbox")).not.toBeInTheDocument();
    const panel = await openPanel("Clean fridge");
    expect(facts(panel)).toMatchObject({ "Assigned To:": "Unassigned" });
    await userEvent.click(within(panel).getByRole("button", { name: "Edit Clean fridge" }));

    expect(onEditChore).toHaveBeenCalledWith(expect.objectContaining({ id: "Clean fridge" }));
  });
});
