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
    ["no name", { ...valid, name: "" }, "Name", "Name is required."],
    ["a name over 30 characters", { ...valid, name: "x".repeat(31) }, "Name", "Name must be 30 characters or fewer."],
    ["no email", { ...valid, email: "" }, "Email", "Email is required."],
    ["an email without a domain", { ...valid, email: "ana@example" }, "Email", "Enter a valid email address."],
    ["no password", { ...valid, password: "", confirm: "" }, "Password", "Password is required."],
    [
      "a short password",
      { ...valid, password: "short1", confirm: "short1" },
      "Password",
      "Password must be at least 8 characters long and include 1 number.",
    ],
    [
      "a password without a number",
      { ...valid, password: "correct-horse", confirm: "correct-horse" },
      "Password",
      "Password must be at least 8 characters long and include 1 number.",
    ],
    ["passwords that differ", { ...valid, confirm: "correct-horse-2" }, "Confirm password", "Passwords do not match."],
  ])("catches %s before calling the server (SCRUM-2)", async (_label, values, field, message) => {
    render(<SignUp onLogIn={() => {}} />);

    await fill(values);

    expect(screen.getByLabelText(field)).toHaveAccessibleDescription(message);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("shows every error at once, keeps Name and Email, and clears both passwords", async () => {
    render(<SignUp onLogIn={() => {}} />);

    await fill({ name: "x".repeat(31), email: "ana@", password: "short", confirm: "other" });

    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("Name must be 30 characters or fewer.");
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Enter a valid email address.");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
      "Password must be at least 8 characters long and include 1 number.",
    );
    expect(screen.getByLabelText("Confirm password")).toHaveAccessibleDescription("Passwords do not match.");
    expect(screen.getByLabelText("Name")).toHaveValue("x".repeat(31));
    expect(screen.getByLabelText("Email")).toHaveValue("ana@");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm password")).toHaveValue("");
  });

  it("creates the account with a trimmed name and email", async () => {
    render(<SignUp onLogIn={() => {}} />);

    await fill({ ...valid, name: "  Ana Lopez ", email: " ana@example.com " });

    expect(signUp).toHaveBeenCalledWith({ name: "Ana Lopez", email: "ana@example.com", password: "correct-horse-1" });
  });

  it("points to Log in when the email already has an account, and clears the passwords", async () => {
    signUp.mockResolvedValue({ data: null, error: { code: "USER_ALREADY_EXISTS", status: 422 } });
    render(<SignUp onLogIn={() => {}} />);

    await fill(valid);

    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      "An account with this email already exists. Use a different email or Log in instead.",
    );
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("shows the server's own rule check on the password field", async () => {
    signUp.mockResolvedValue({ data: null, error: { code: "PASSWORD_INVALID", status: 400 } });
    render(<SignUp onLogIn={() => {}} />);

    await fill(valid);

    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
      "Password must be at least 8 characters long and include 1 number.",
    );
  });

  it("shows a server error as a banner above the form, keeping the passwords", async () => {
    signUp.mockResolvedValue({ data: null, error: { status: 500, message: "Internal Server Error" } });
    render(<SignUp onLogIn={() => {}} />);

    await fill(valid);

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("Something went wrong. Please try again.");
    expect(banner.compareDocumentPosition(screen.getByLabelText("Name"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByLabelText("Password")).toHaveValue("correct-horse-1");
  });

  it("links back to Log in", async () => {
    const onLogIn = vi.fn();
    render(<SignUp onLogIn={onLogIn} />);

    await userEvent.click(screen.getByRole("button", { name: "Already have an account? Log in" }));

    expect(onLogIn).toHaveBeenCalledTimes(1);
  });
});
