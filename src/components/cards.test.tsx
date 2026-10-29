// OverdueBanner, ProgressCard and NoteCard: the display cards.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import NoteCard from "./NoteCard.tsx";
import OverdueBanner from "./OverdueBanner.tsx";
import ProgressCard from "./ProgressCard.tsx";

describe("OverdueBanner", () => {
  it("shows its title and message as a status", () => {
    render(<OverdueBanner title="1 chore is overdue" message="Take out trash was due Monday." />);

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("1 chore is overdue");
    expect(banner).toHaveTextContent("Take out trash was due Monday.");
  });

  it("has no action button unless given onAction", () => {
    render(<OverdueBanner title="1 chore is overdue" message="Take out trash was due Monday." />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onAction from its Review button, or a custom label", async () => {
    const onAction = vi.fn();
    render(<OverdueBanner title="t" message="m" actionLabel="See chores" onAction={onAction} />);

    await userEvent.click(screen.getByRole("button", { name: "See chores" }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe("ProgressCard", () => {
  it("shows the count, On track and a progress bar screen readers can read", () => {
    render(<ProgressCard done={5} total={8} />);

    expect(screen.getByText("5 of 8 chores done")).toBeInTheDocument();
    expect(screen.getByText("On track")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "5 of 8 chores done" });
    expect(bar).toHaveAttribute("aria-valuenow", "5");
    expect(bar).toHaveAttribute("aria-valuemax", "8");
    expect(bar.firstElementChild).toHaveStyle({ width: "62.5%" });
  });

  it.each([
    [9, 8, "100%"],
    [-1, 8, "0%"],
  ])("keeps the bar between empty and full (%i of %i → %s)", (done, total, width) => {
    render(<ProgressCard done={done} total={total} />);

    expect(screen.getByRole("progressbar").firstElementChild).toHaveStyle({ width });
  });

  it("says Complete! when everything due is done", () => {
    render(<ProgressCard done={8} total={8} late={1} />);

    expect(screen.getByText("8 of 8 chores done")).toBeInTheDocument();
    expect(screen.getByText("Complete!")).toBeInTheDocument();
  });

  it("counts late chores and shows them as a yellow segment over the green fill", () => {
    render(<ProgressCard done={3} total={8} late={1} />);

    expect(screen.getByText("1 Late")).toHaveClass("status", "lateStatus");
    const [fill, lateFill] = [...screen.getByRole("progressbar").children];
    expect(fill).toHaveStyle({ width: "37.5%" });
    expect(lateFill).toHaveClass("lateFill");
    expect(lateFill).toHaveStyle({ width: "12.5%" });
  });

  it("says No Chores Yet, with no status and an empty bar, when nothing is due", () => {
    const { container } = render(<ProgressCard done={0} total={0} />);

    expect(screen.getByText("No Chores Yet")).toBeInTheDocument();
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(screen.getByRole("progressbar")).toBeEmptyDOMElement();
  });
});

describe("NoteCard", () => {
  it("credits the housemate and puts the note in curly quotes", () => {
    render(<NoteCard from="Sam" note="Left the spare key under the blue planter." />);

    expect(screen.getByText("Note from Sam")).toBeInTheDocument();
    expect(screen.getByText("“Left the spare key under the blue planter.”")).toBeInTheDocument();
  });
});
