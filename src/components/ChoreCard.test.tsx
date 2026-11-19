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
      <ChoreCard name="Wash dishes" details="You · done today" status="done" onToggle={() => {}} />,
    );

    expect(screen.getByRole("checkbox", { name: "Mark Wash dishes not done" })).toBeChecked();
    expect(screen.getByText("Done")).toHaveClass("success");
    expect(container.firstChild).toHaveClass("done");
  });

  it("shows a chore done after its due date with the Late chip (Figma Status4)", () => {
    const { container } = render(
      <ChoreCard name="Buy dish soap" details="You · done today" status="late" onToggle={() => {}} />,
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

  it("has no chevron or dropdown without a panel", () => {
    render(<ChoreCard name="Mop" details="You · due today" status="pending" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens and closes its dropdown from the name or the chevron to the right of the chip", async () => {
    render(
      <ChoreCard
        name="Mop"
        details="Sam · due Mon, Oct 5"
        status="overdue"
        panel={{ rows: [["Assigned To:", "Sam"], ["Chore Details:", "Kitchen floor"]] }}
      />,
    );
    const toggle = screen.getByRole("button", { name: "Mop Sam · due Mon, Oct 5" });
    const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(panel).not.toBeVisible();

    const chevron = toggle.parentElement!.querySelector("button[aria-hidden]")!;
    expect(screen.getByText("Overdue").compareDocumentPosition(chevron)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    await userEvent.click(chevron);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(panel).toBeVisible();
    expect(screen.getByText("Kitchen floor")).toBeVisible();

    await userEvent.click(toggle);
    expect(panel).not.toBeVisible();
  });

  it("shows the pencil and View history only when given them", async () => {
    const onEdit = vi.fn();
    const onViewHistory = vi.fn();
    const { rerender } = render(
      <ChoreCard name="Mop" details="You · due today" status="pending" panel={{ rows: [], onViewHistory }} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /^Mop/ }));
    expect(screen.queryByRole("button", { name: "Edit Mop" })).not.toBeInTheDocument();

    rerender(<ChoreCard name="Mop" details="You · due today" status="pending" panel={{ rows: [], onEdit, onViewHistory }} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit Mop" }));
    await userEvent.click(screen.getByRole("button", { name: "View history for Mop" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onViewHistory).toHaveBeenCalledTimes(1);
  });
});
