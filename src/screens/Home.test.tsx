import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Household } from "../api/households.ts";
import Home from "./Home.tsx";

const household: Household = {
  id: "h1",
  name: "Maple St House",
  inviteCode: "K7Q2MXAB",
  createdAt: "2026-10-17T00:00:00.000Z",
  role: "owner",
  members: [],
};

describe("Home", () => {
  it("shows the household name and the empty state, with the menu closed", () => {
    render(<Home household={household} onLogOut={() => {}} />);

    expect(screen.getByRole("heading", { name: "Maple St House" })).toBeInTheDocument();
    expect(screen.getByText("No chores yet. Add the first one.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens the menu with Log out as a primary button, focused", async () => {
    render(<Home household={household} onLogOut={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));

    const logOut = screen.getByRole("menuitem", { name: "Log out" });
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "true");
    expect(logOut).toHaveClass("button", "primary");
    expect(logOut).toHaveFocus();
  });

  it("logs out from the menu", async () => {
    const onLogOut = vi.fn();
    render(<Home household={household} onLogOut={onLogOut} />);

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(onLogOut).toHaveBeenCalledTimes(1);
  });

  it("closes the menu with Escape, a tap outside, or the menu button again", async () => {
    render(<Home household={household} onLogOut={() => {}} />);
    const menuButton = screen.getByRole("button", { name: "Menu" });

    await userEvent.click(menuButton);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(menuButton);
    fireEvent.pointerDown(screen.getByText("No chores yet. Add the first one."));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(menuButton);
    await userEvent.click(menuButton);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
