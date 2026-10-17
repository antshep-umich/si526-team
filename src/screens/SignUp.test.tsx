import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignUp from "./SignUp.tsx";

const { signUp } = vi.hoisted(() => ({ signUp: vi.fn() }));
vi.mock("../auth.ts", () => ({ authClient: { signUp: { email: signUp } } }));

async function fill(values: { name?: string; email?: string; password?: string; confirm?: string }) {
  if (values.name) await userEvent.type(screen.getByLabelText("Name"), values.name);
  if (values.email) await userEvent.type(screen.getByLabelText("Email"), values.email);
  if (values.password) await userEvent.type(screen.getByLabelText("Password"), values.password);
  if (values.confirm) await userEvent.type(screen.getByLabelText("Confirm password"), values.confirm);
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
}

const valid = { name: "Ana Lopez", email: "ana@example.com", password: "correct-horse-1", confirm: "correct-horse-1" };

beforeEach(() => {
  signUp.mockReset();
  signUp.mockResolvedValue({ data: {}, error: null });
});

describe("SignUp", () => {
  it("shows the four Figma fields", () => {
    render(<SignUp onLogIn={() => {}} />);

    expect(screen.getByRole("heading", { name: "Create Account" })).toBeInTheDocument();
    for (const label of ["Name", "Email", "Password", "Confirm password"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it.each([
    ["no name", { ...valid, name: "" }, "Name", "Enter your name."],
    ["no email", { ...valid, email: "" }, "Email", "Enter your email."],
    ["a short password", { ...valid, password: "short", confirm: "short" }, "Password", "Use at least 8 characters."],
    ["passwords that differ", { ...valid, confirm: "correct-horse-2" }, "Confirm password", "The passwords don't match."],
  ])("catches %s before calling the server", async (_label, values, field, message) => {
    render(<SignUp onLogIn={() => {}} />);

    await fill(values);

    expect(screen.getByLabelText(field)).toHaveAccessibleDescription(message);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("creates the account with a trimmed name and email", async () => {
    render(<SignUp onLogIn={() => {}} />);

    await fill({ ...valid, name: "  Ana Lopez ", email: " ana@example.com " });

    expect(signUp).toHaveBeenCalledWith({ name: "Ana Lopez", email: "ana@example.com", password: "correct-horse-1" });
  });

  it("points to Log in when the email already has an account", async () => {
    signUp.mockResolvedValue({ data: null, error: { code: "USER_ALREADY_EXISTS", status: 422 } });
    render(<SignUp onLogIn={() => {}} />);

    await fill(valid);

    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      "An account already uses this email. Log in instead.",
    );
  });

  it("links back to Log in", async () => {
    const onLogIn = vi.fn();
    render(<SignUp onLogIn={onLogIn} />);

    await userEvent.click(screen.getByRole("button", { name: "Already have an account? Log in" }));

    expect(onLogIn).toHaveBeenCalledTimes(1);
  });
});
