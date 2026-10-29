// TabBar, TabFilter, DoneSection, TextLink and ThemedIcon.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import DoneSection from "./DoneSection.tsx";
import { icons } from "./icons.ts";
import TabBar from "./TabBar.tsx";
import TabFilter from "./TabFilter.tsx";
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

  it("shows tabs without a screen yet, but they do nothing", async () => {
    const onSelect = vi.fn();
    render(<TabBar selected="chores" onSelect={onSelect} available={["chores"]} />);

    expect(screen.getByRole("button", { name: "House" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(screen.getByRole("button", { name: "House" }));

    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("TabFilter", () => {
  function Filter({ onSelect = () => {} }: { onSelect?: (id: string) => void }) {
    const [selected, setSelected] = useState<"all" | "mine">("all");
    return (
      <TabFilter
        label="Show chores"
        options={[
          { id: "all", label: "All" },
          { id: "mine", label: "Mine" },
        ]}
        selected={selected}
        onSelect={(id) => {
          setSelected(id);
          onSelect(id);
        }}
      />
    );
  }

  it("is a radio group with the selected option checked", () => {
    render(<Filter />);

    expect(screen.getByRole("radiogroup", { name: "Show chores" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "All" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "All" })).toHaveClass("selected");
    expect(screen.getByRole("radio", { name: "Mine" })).not.toBeChecked();
  });

  it("switches on a tap", async () => {
    const onSelect = vi.fn();
    render(<Filter onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("radio", { name: "Mine" }));

    expect(onSelect).toHaveBeenCalledWith("mine");
    expect(screen.getByRole("radio", { name: "Mine" })).toBeChecked();
  });

  it("moves with the arrow keys, and only the selected option is in the Tab order", async () => {
    render(<Filter />);
    expect(screen.getByRole("radio", { name: "Mine" })).toHaveAttribute("tabindex", "-1");

    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");

    expect(screen.getByRole("radio", { name: "Mine" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Mine" })).toHaveFocus();
  });
});

describe("DoneSection", () => {
  it("shows the count and says whether it's open", async () => {
    const onToggle = vi.fn();
    const { rerender } = render(<DoneSection count={2} expanded={false} onToggle={onToggle} controls="done-list" />);

    const button = screen.getByRole("button", { name: "Done (2)" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", "done-list");
    expect(button.querySelector('img[data-icon-theme="light"]')).toHaveAttribute("src", icons.chevronDown.light);

    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<DoneSection count={2} expanded onToggle={onToggle} controls="done-list" />);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button.querySelector('img[data-icon-theme="light"]')).toHaveAttribute("src", icons.chevronUp.light);
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
