import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Button from "./Button.tsx";

describe("Button", () => {
  it("is a primary button that doesn't submit forms unless asked", () => {
    render(<Button>Add chore</Button>);
    const button = screen.getByRole("button", { name: "Add chore" });

    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("button", "primary");
    expect(button).not.toHaveClass("fullWidth");
  });

  it("supports the outline variant, full width and submit", () => {
    render(
      <Button variant="outline" fullWidth type="submit">
        Join with a code
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Join with a code" });

    expect(button).toHaveClass("outline", "fullWidth");
    expect(button).toHaveAttribute("type", "submit");
  });

  it("calls onClick when tapped, but not when disabled", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Save</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("passes other attributes through, such as role", () => {
    render(<Button role="menuitem">Log out</Button>);

    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
  });
});
