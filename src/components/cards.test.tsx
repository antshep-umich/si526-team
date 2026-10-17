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
  it("shows the count, the status and a progress bar screen readers can read", () => {
    render(<ProgressCard done={5} total={8} status="On track" />);

    expect(screen.getByText("5 of 8 chores done")).toBeInTheDocument();
    expect(screen.getByText("On track")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "5 of 8 chores done" });
    expect(bar).toHaveAttribute("aria-valuenow", "5");
    expect(bar).toHaveAttribute("aria-valuemax", "8");
    expect(bar.firstElementChild).toHaveStyle({ width: "62.5%" });
  });

  it.each([
    [0, 0, "0%"],
    [9, 8, "100%"],
    [-1, 8, "0%"],
  ])("keeps the bar between empty and full (%i of %i → %s)", (done, total, width) => {
    render(<ProgressCard done={done} total={total} />);

    expect(screen.getByRole("progressbar").firstElementChild).toHaveStyle({ width });
  });

  it("leaves the status out when there isn't one", () => {
    const { container } = render(<ProgressCard done={1} total={2} />);

    expect(container.querySelectorAll("p")).toHaveLength(1);
  });
});

describe("NoteCard", () => {
  it("credits the housemate and puts the note in curly quotes", () => {
    render(<NoteCard from="Sam" note="Left the spare key under the blue planter." />);

    expect(screen.getByText("Note from Sam")).toBeInTheDocument();
    expect(screen.getByText("“Left the spare key under the blue planter.”")).toBeInTheDocument();
  });
});
