// TabBar, TextLink and ThemedIcon.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { icons } from "./icons.ts";
import TabBar from "./TabBar.tsx";
import TextLink from "./TextLink.tsx";
import ThemedIcon from "./ThemedIcon.tsx";

describe("TabBar", () => {
  it("shows the three tabs and marks the selected one as the current page", () => {
    render(<TabBar selected="schedule" onSelect={() => {}} />);

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav).toHaveTextContent("ChoresScheduleHouse");
    expect(screen.getByRole("button", { name: "Schedule" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Chores" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Schedule" })).toHaveClass("active");
  });

  it("uses the active icon for the selected tab and the inactive icon for the others", () => {
    render(<TabBar selected="house" onSelect={() => {}} />);

    const lightIcon = (tab: string) =>
      screen.getByRole("button", { name: tab }).querySelector('img[data-icon-theme="light"]')?.getAttribute("src");
    expect(lightIcon("House")).toBe(icons.tabHouseActive.light);
    expect(lightIcon("Chores")).toBe(icons.tabChores.light);
    expect(lightIcon("Schedule")).toBe(icons.tabSchedule.light);
  });

  it("reports the tab the user picked", async () => {
    const onSelect = vi.fn();
    render(<TabBar selected="chores" onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: "House" }));

    expect(onSelect).toHaveBeenCalledWith("house");
  });
});

describe("TextLink", () => {
  it("is a button (it switches screens) and calls onClick", async () => {
    const onClick = vi.fn();
    render(<TextLink onClick={onClick}>Forgot your password?</TextLink>);

    const link = screen.getByRole("button", { name: "Forgot your password?" });
    expect(link).toHaveAttribute("type", "button");
    await userEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("ThemedIcon", () => {
  it("renders the light and the dark file, hidden from screen readers", () => {
    const { container } = render(<ThemedIcon name="clock" />);

    const wrapper = container.firstElementChild!;
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
    const images = wrapper.querySelectorAll("img");
    expect([...images].map((img) => [img.dataset.iconTheme, img.getAttribute("src")])).toEqual([
      ["light", icons.clock.light],
      ["dark", icons.clock.dark],
    ]);
  });

  it("has a light and a dark file for every icon", () => {
    for (const [name, files] of Object.entries(icons)) {
      expect(files.light, name).toBeTruthy();
      expect(files.dark, name).toBeTruthy();
    }
  });
});
