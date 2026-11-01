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

/** Fills the form with `valid` plus `changes`, submits it, and returns the field's error. */
async function errorFor(field: string, changes: Partial<typeof valid>) {
  render(<SignUp onLogIn={() => {}} />);
  await fill({ ...valid, ...changes });
  return screen.getByLabelText(field);
}

beforeEach(() => {
  signUp.mockReset();
  signUp.mockResolvedValue({ data: {}, error: null });
});

describe("SignUp acceptance criteria", { tags: ["SCRUM-2"] }, () => {
  it("AC1: has the four fields Name, Email, Password and Confirm password, all required", async () => {
    render(<SignUp onLogIn={() => {}} />);

    expect(screen.getByRole("heading", { name: "Create Account" })).toBeInTheDocument();
    for (const label of ["Name", "Email", "Password", "Confirm password"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }

    await fill({ password: "correct-horse-1" }); // everything else left empty
    for (const label of ["Name", "Email", "Confirm password"]) {
      expect(screen.getByLabelText(label)).toHaveAttribute("aria-invalid", "true");
    }
    await fill({});
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("AC2: accepts a name of 30 characters and a password of 8 characters with a number", async () => {
    render(<SignUp onLogIn={() => {}} />);

    await fill({ ...valid, name: "x".repeat(30), password: "passwor1", confirm: "passwor1" });

    expect(signUp).toHaveBeenCalledWith({ name: "x".repeat(30), email: valid.email, password: "passwor1" });
  });

  it.each([
    ["a 31-character name", { name: "x".repeat(31) }, "Name"],
    ["a 7-character password", { password: "passwo1", confirm: "passwo1" }, "Password"],
    ["a password without a number", { password: "password", confirm: "password" }, "Password"],
  ])("AC2: refuses %s", async (_label, changes, field) => {
    expect(await errorFor(field, changes)).toHaveAttribute("aria-invalid", "true");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("AC4: shows every error at once under its field, keeps Name and Email, and clears both passwords", async () => {
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

  it('AC6: says "Name is required." when Name is empty', async () => {
    expect(await errorFor("Name", { name: "" })).toHaveAccessibleDescription("Name is required.");
  });

  it('AC7: says "Name must be 30 characters or fewer." when Name is over 30 characters', async () => {
    expect(await errorFor("Name", { name: "x".repeat(31) })).toHaveAccessibleDescription(
      "Name must be 30 characters or fewer.",
    );
  });

  it('AC8: says "Email is required." when Email is empty', async () => {
    expect(await errorFor("Email", { email: "" })).toHaveAccessibleDescription("Email is required.");
  });

  it('AC9: says "Enter a valid email address." when the email format is invalid', async () => {
    expect(await errorFor("Email", { email: "ana@example" })).toHaveAccessibleDescription(
      "Enter a valid email address.",
    );
  });

  it("AC10: says the email already has an account when it's registered", async () => {
    signUp.mockResolvedValue({ data: null, error: { code: "USER_ALREADY_EXISTS", status: 422 } });

    expect(await errorFor("Email", {})).toHaveAccessibleDescription(
      "An account with this email already exists. Use a different email or Log in instead.",
    );
  });

  it('AC11: says "Password is required." when Password is empty', async () => {
    expect(await errorFor("Password", { password: "", confirm: "" })).toHaveAccessibleDescription(
      "Password is required.",
    );
  });

  it("AC12: explains the password rules when the password doesn't meet them", async () => {
    expect(await errorFor("Password", { password: "short1", confirm: "short1" })).toHaveAccessibleDescription(
      "Password must be at least 8 characters long and include 1 number.",
    );
  });

  it('AC13: says "Passwords do not match." when they differ', async () => {
    expect(await errorFor("Confirm password", { confirm: "correct-horse-2" })).toHaveAccessibleDescription(
      "Passwords do not match.",
    );
  });

  it("AC14: shows a server error as a banner above the form", async () => {
    signUp.mockResolvedValue({ data: null, error: { status: 500, message: "Internal Server Error" } });
    render(<SignUp onLogIn={() => {}} />);

    await fill(valid);

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("Something went wrong. Please try again.");
    expect(banner.compareDocumentPosition(screen.getByLabelText("Name"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});

describe("SignUp", () => {
  it("creates the account with a trimmed name and email", async () => {
    render(<SignUp onLogIn={() => {}} />);

    await fill({ ...valid, name: "  Ana Lopez ", email: " ana@example.com " });

    expect(signUp).toHaveBeenCalledWith({ name: "Ana Lopez", email: "ana@example.com", password: "correct-horse-1" });
  });

  it("clears the passwords when the server rejects the email", async () => {
    signUp.mockResolvedValue({ data: null, error: { code: "USER_ALREADY_EXISTS", status: 422 } });
    render(<SignUp onLogIn={() => {}} />);

    await fill(valid);

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

  it("keeps the passwords after a server error", async () => {
    signUp.mockResolvedValue({ data: null, error: { status: 500, message: "Internal Server Error" } });
    render(<SignUp onLogIn={() => {}} />);

    await fill(valid);

    expect(screen.getByLabelText("Password")).toHaveValue("correct-horse-1");
  });

  it("links back to Log in", async () => {
    const onLogIn = vi.fn();
    render(<SignUp onLogIn={onLogIn} />);

    await userEvent.click(screen.getByRole("button", { name: "Already have an account? Log in" }));

    expect(onLogIn).toHaveBeenCalledTimes(1);
  });
});
