import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ChoreCard from "./ChoreCard.tsx";

describe("ChoreCard", () => {
  it("shows a pending chore with an unchecked checkbox and no chip", () => {
    render(<ChoreCard name="Clean bathroom" details="You · due today" status="pending" onToggle={() => {}} />);

    expect(screen.getByText("Clean bathroom")).toBeInTheDocument();
    expect(screen.getByText("You · due today")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Mark Clean bathroom done" })).not.toBeChecked();
    expect(screen.queryByText("Overdue")).not.toBeInTheDocument();
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
  });

  it("shows an overdue chore with the overdue chip", () => {
    const { container } = render(
      <ChoreCard name="Take out trash" details="Riley · due Monday" status="overdue" onToggle={() => {}} />,
    );

    expect(screen.getByText("Overdue")).toHaveClass("chip", "overdue");
    expect(container.firstChild).toHaveClass("overdue");
  });

  it("shows a done chore as checked, with the Done chip and an undo label", () => {
    render(<ChoreCard name="Wash dishes" details="Jordan · done 9:40 AM" status="done" onToggle={() => {}} />);

    expect(screen.getByRole("checkbox", { name: "Mark Wash dishes not done" })).toBeChecked();
    expect(screen.getByText("Done")).toHaveClass("success");
  });

  it("calls onToggle when the checkbox is tapped", async () => {
    const onToggle = vi.fn();
    render(<ChoreCard name="Clean bathroom" details="You · due today" status="pending" onToggle={onToggle} />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("is display-only without onToggle", () => {
    render(<ChoreCard name="Clean bathroom" details="You · due today" status="pending" />);

    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
});
