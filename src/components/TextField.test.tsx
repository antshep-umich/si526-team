import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TextField from "./TextField.tsx";

describe("TextField", () => {
  it("labels its input and passes input attributes through", async () => {
    const onChange = vi.fn();
    render(<TextField label="Email" type="email" placeholder="xxx@example.com" onChange={onChange} />);

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("placeholder", "xxx@example.com");

    await userEvent.type(input, "a");
    expect(onChange).toHaveBeenCalled();
  });

  it("shows no error and isn't marked invalid by default", () => {
    render(<TextField label="Chore name" />);

    const input = screen.getByLabelText("Chore name");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("shows a blocking error, marks the input invalid and links the two for screen readers", () => {
    render(<TextField label="Chore name" error="Give the chore a name first." />);

    const input = screen.getByLabelText("Chore name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Give the chore a name first.");
  });

  it("gives each field its own id, so two fields with the same label don't collide", () => {
    render(
      <>
        <TextField label="Password" />
        <TextField label="Confirm password" />
      </>,
    );

    const [first, second] = screen.getAllByRole("textbox");
    expect(first!.id).not.toBe(second!.id);
  });
});
