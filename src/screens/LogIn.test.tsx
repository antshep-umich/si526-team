import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LogIn from "./LogIn.tsx";

const { signIn } = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock("../auth.ts", () => ({ authClient: { signIn: { email: signIn } } }));

function renderLogIn(props: Partial<Parameters<typeof LogIn>[0]> = {}) {
  const callbacks = { onSignUp: vi.fn(), onForgotPassword: vi.fn() };
  render(<LogIn {...callbacks} {...props} />);
  return callbacks;
}

async function fillAndSubmit(email: string, password: string) {
  if (email) await userEvent.type(screen.getByLabelText("Email"), email);
  if (password) await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Log in" }));
}

beforeEach(() => {
  signIn.mockReset();
  signIn.mockResolvedValue({ data: {}, error: null });
});

// SCRUM-3 logs in with email, not name (team decision; the AC file has the corrected text).
describe("LogIn acceptance criteria", { tags: ["SCRUM-3"] }, () => {
  it("AC1: has two fields, Email and Password, both required", async () => {
    renderLogIn();

    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getAllByRole("textbox")).toHaveLength(1); // the password field isn't a textbox

    await fillAndSubmit("", "");
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("AC2: logs in with the email and password", async () => {
    renderLogIn();

    await fillAndSubmit("  ana@example.com ", "correct-horse-1");

    expect(signIn).toHaveBeenCalledWith({ email: "ana@example.com", password: "correct-horse-1" });
  });

  it('AC6: says "Email is required." when Email is empty', async () => {
    renderLogIn();

    await fillAndSubmit("", "correct-horse-1");

    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Email is required.");
    expect(signIn).not.toHaveBeenCalled();
  });

  it('AC7: says "Password is required." when Password is empty', async () => {
    renderLogIn();

    await fillAndSubmit("ana@example.com", "");

    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Password is required.");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("AC8: says the email or password is incorrect without saying which", async () => {
    signIn.mockResolvedValue({ data: null, error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 } });
    renderLogIn();

    await fillAndSubmit("ana@example.com", "wrong-password");

    expect(screen.getByRole("alert")).toHaveTextContent("Email or password is incorrect.");
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Password")).not.toHaveAttribute("aria-invalid");
  });

  it('AC9: says "Something went wrong. Please try again." on a server error', async () => {
    signIn.mockResolvedValue({ data: null, error: { status: 500, message: "Internal Server Error" } });
    renderLogIn();

    await fillAndSubmit("ana@example.com", "correct-horse-1");

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
  });
});

describe("LogIn", () => {
  it("shows the Figma placeholder and the Forgot password link", () => {
    renderLogIn();

    expect(screen.getByLabelText("Email")).toHaveAttribute("placeholder", "xxx@example.com");
    expect(screen.getByRole("button", { name: "Forgot your password?" })).toBeInTheDocument();
  });

  it("shows a failure to reach the server as a server error, under the button", async () => {
    signIn.mockRejectedValue(new TypeError("Failed to fetch"));
    renderLogIn();

    await fillAndSubmit("ana@example.com", "correct-horse-1");

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
  });

  it("disables the form while signing in", async () => {
    signIn.mockReturnValue(new Promise(() => {}));
    renderLogIn();

    await fillAndSubmit("ana@example.com", "correct-horse-1");

    expect(screen.getByRole("button", { name: "Logging in…" })).toBeDisabled();
    expect(screen.getByLabelText("Email")).toBeDisabled();
  });

  it("starts with the email and notice it's given (after a password reset)", () => {
    renderLogIn({ initialEmail: "ana@example.com", notice: "Password updated. Log in with your new password." });

    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.com");
    expect(screen.getByText("Password updated. Log in with your new password.")).toBeInTheDocument();
  });

  it("links to Forgot password and Sign up", async () => {
    const { onForgotPassword, onSignUp } = renderLogIn();

    await userEvent.click(screen.getByRole("button", { name: "Forgot your password?" }));
    await userEvent.click(screen.getByRole("button", { name: "New here? Create an account" }));

    expect(onForgotPassword).toHaveBeenCalledTimes(1);
    expect(onSignUp).toHaveBeenCalledTimes(1);
  });
});
