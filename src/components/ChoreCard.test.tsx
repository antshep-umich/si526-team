import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ChoreCard from "./ChoreCard.tsx";

describe("ChoreCard", () => {
  it("shows a to-do chore with an unchecked checkbox and no chip", () => {
    render(<ChoreCard name="Clean bathroom" details="You · due today" status="pending" onToggle={() => {}} />);

    expect(screen.getByText("Clean bathroom")).toBeInTheDocument();
    expect(screen.getByText("You · due today")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Mark Clean bathroom done" })).not.toBeChecked();
    for (const chip of ["Overdue", "Done", "Late", "To do"]) {
      expect(screen.queryByText(chip)).not.toBeInTheDocument();
    }
  });

  it("shows an overdue chore with the overdue chip", () => {
    const { container } = render(
      <ChoreCard name="Take out trash" details="Sam · due Mon, Oct 5" status="overdue" onToggle={() => {}} />,
    );

    expect(screen.getByText("Overdue")).toHaveClass("chip", "overdue");
    expect(container.firstChild).toHaveClass("overdue");
  });

  it("shows a done chore as checked and struck through, with the Done chip and an undo label", () => {
    const { container } = render(
      <ChoreCard name="Wash dishes" details="You · done today · due today" status="done" onToggle={() => {}} />,
    );

    expect(screen.getByRole("checkbox", { name: "Mark Wash dishes not done" })).toBeChecked();
    expect(screen.getByText("Done")).toHaveClass("success");
    expect(container.firstChild).toHaveClass("done");
  });

  it("shows a chore done after its due date with the Late chip (Figma Status4)", () => {
    const { container } = render(
      <ChoreCard name="Buy dish soap" details="You · done today · due Fri, Oct 9" status="late" onToggle={() => {}} />,
    );

    expect(screen.getByRole("checkbox", { name: "Mark Buy dish soap not done" })).toBeChecked();
    expect(screen.getByText("Late")).toHaveClass("chip", "late");
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
    expect(container.firstChild).toHaveClass("done");
  });

  it("calls onToggle when the checkbox is tapped", async () => {
    const onToggle = vi.fn();
    render(<ChoreCard name="Clean bathroom" details="You · due today" status="pending" onToggle={onToggle} />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("has no checkbox without onToggle (someone else's chore, SCRUM-8)", () => {
    render(<ChoreCard name="Vacuum living room" details="Alex · due tomorrow" status="pending" />);

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText("Vacuum living room")).toBeInTheDocument();
  });

  it("turns the checkbox off while a change is saving", () => {
    render(<ChoreCard name="Clean bathroom" details="You · due today" status="done" onToggle={() => {}} busy />);

    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
});
