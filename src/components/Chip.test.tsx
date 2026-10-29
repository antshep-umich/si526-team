import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Chip from "./Chip.tsx";

describe("Chip", () => {
  it("shows its label in the overdue style", () => {
    render(<Chip tone="overdue">Overdue</Chip>);

    expect(screen.getByText("Overdue")).toHaveClass("chip", "overdue");
  });

  it("shows its label in the late style (done after the due date)", () => {
    render(<Chip tone="late">Late</Chip>);

    expect(screen.getByText("Late")).toHaveClass("chip", "late");
  });

  it("shows its label in the success style (Done, Owner)", () => {
    render(<Chip tone="success">Owner</Chip>);

    expect(screen.getByText("Owner")).toHaveClass("chip", "success");
  });
});
