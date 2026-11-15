// The header on every screen in a household, and its menu (src/screens/Header.tsx).
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Header, { MenuProvider } from "./Header.tsx";

function renderHeader() {
  const actions = { onChoreHistory: vi.fn(), onHouseholdChoreHistory: vi.fn(), onLogOut: vi.fn() };
  render(
    <MenuProvider actions={actions}>
      <Header overline="Maple St House" title="My chore history">
        <p>Notes</p>
      </Header>
      <button type="button">Something else</button>
    </MenuProvider>,
  );
  return actions;
}

const menuButton = () => screen.getByRole("button", { name: "Menu" });
const openMenu = () => userEvent.click(menuButton());

describe("Header", () => {
  it("shows the overline, the title as the screen's heading, and what's under it", () => {
    renderHeader();

    expect(screen.getByText("Maple St House")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "My chore history" })).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
  });

  it("has no menu outside a household", () => {
    render(<Header title="Add chore" />);

    expect(screen.getByRole("heading", { level: 1, name: "Add chore" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Menu" })).not.toBeInTheDocument();
  });
});

describe("Header menu", () => {
  it("starts closed", () => {
    renderHeader();

    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens as a list: the two histories, then Log out, with the first item focused", async () => {
    renderHeader();

    await openMenu();

    const menu = screen.getByRole("menu", { name: "Menu" });
    expect(menuButton()).toHaveAttribute("aria-expanded", "true");
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "My chore history",
      "Household chore history",
      "Log out",
    ]);
    expect(within(menu).getByRole("separator")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "My chore history" })).toHaveFocus();
  });

  it.each([
    ["My chore history", "onChoreHistory"],
    ["Household chore history", "onHouseholdChoreHistory"],
    ["Log out", "onLogOut"],
  ] as const)("%s does its job and closes the menu", async (item, action) => {
    const actions = renderHeader();

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: item }));

    expect(actions[action]).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("moves between items with the arrow keys, Home and End", async () => {
    renderHeader();
    await openMenu();
    const item = (name: string) => screen.getByRole("menuitem", { name });

    await userEvent.keyboard("{ArrowDown}");
    expect(item("Household chore history")).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(item("Log out")).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(item("My chore history")).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(item("Log out")).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(item("My chore history")).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(item("Log out")).toHaveFocus();
  });

  it("closes with Escape (back to the menu button), a tap outside, or the menu button again", async () => {
    renderHeader();

    await openMenu();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(menuButton()).toHaveFocus();

    await openMenu();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Something else" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await openMenu();
    await openMenu();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
