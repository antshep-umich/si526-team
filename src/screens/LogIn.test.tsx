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

describe("LogIn", () => {
  it("shows the Figma fields and links", () => {
    renderLogIn();

    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("placeholder", "xxx@example.com");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Forgot your password?" })).toBeInTheDocument();
  });

  it("asks for the email, then the password, before calling the server", async () => {
    renderLogIn();

    await fillAndSubmit("", "");
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Enter your email.");

    await fillAndSubmit("ana@example.com", "");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Enter your password.");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("signs in with the trimmed email", async () => {
    renderLogIn();

    await fillAndSubmit("  ana@example.com ", "correct-horse-1");

    expect(signIn).toHaveBeenCalledWith({ email: "ana@example.com", password: "correct-horse-1" });
  });

  it("shows a wrong password on the password field", async () => {
    signIn.mockResolvedValue({ data: null, error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 } });
    renderLogIn();

    await fillAndSubmit("ana@example.com", "wrong-password");

    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("That email and password don't match.");
  });

  it("shows a network failure under the button", async () => {
    signIn.mockRejectedValue(new TypeError("Failed to fetch"));
    renderLogIn();

    await fillAndSubmit("ana@example.com", "correct-horse-1");

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't reach the server");
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
