import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPassword from "./ForgotPassword.tsx";

const { resetPassword } = vi.hoisted(() => ({ resetPassword: vi.fn() }));
vi.mock("../api/passwordReset.ts", () => ({ resetPassword }));

function renderForgot() {
  const callbacks = { onDone: vi.fn(), onBack: vi.fn() };
  render(<ForgotPassword {...callbacks} />);
  return callbacks;
}

async function continueWith(email: string) {
  if (email) await userEvent.type(screen.getByLabelText("Email"), email);
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
}

async function setPassword(password: string, confirm = password) {
  await userEvent.type(screen.getByLabelText("New password"), password);
  await userEvent.type(screen.getByLabelText("Confirm new password"), confirm);
  await userEvent.click(screen.getByRole("button", { name: "Save new password" }));
}

beforeEach(() => {
  resetPassword.mockReset();
  resetPassword.mockResolvedValue({ ok: true });
});

describe("ForgotPassword (stand-in)", () => {
  it("asks for the email first", async () => {
    renderForgot();

    await continueWith("");

    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Enter your email.");
  });

  it("then asks for the new password, saves it and reports the trimmed email", async () => {
    const { onDone } = renderForgot();

    await continueWith(" ana@example.com ");
    expect(screen.getByRole("heading", { name: "Set a new password" })).toBeInTheDocument();
    expect(screen.getByText("For ana@example.com")).toBeInTheDocument();
    await setPassword("new-password-1");

    expect(resetPassword).toHaveBeenCalledWith("ana@example.com", "new-password-1");
    expect(onDone).toHaveBeenCalledWith("ana@example.com");
  });

  it("checks the new password before saving", async () => {
    renderForgot();
    await continueWith("ana@example.com");

    await setPassword("short");
    expect(screen.getByLabelText("New password")).toHaveAccessibleDescription("Use at least 8 characters.");

    await userEvent.clear(screen.getByLabelText("New password"));
    await userEvent.clear(screen.getByLabelText("Confirm new password"));
    await setPassword("new-password-1", "new-password-2");
    expect(screen.getByLabelText("Confirm new password")).toHaveAccessibleDescription("The passwords don't match.");

    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("goes back to the email step when no account uses that email", async () => {
    resetPassword.mockResolvedValue({ ok: false, code: "ACCOUNT_NOT_FOUND" });
    const { onDone } = renderForgot();

    await continueWith("nobody@example.com");
    await setPassword("new-password-1");

    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("No account uses that email.");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("shows a network failure under the button", async () => {
    resetPassword.mockResolvedValue({ ok: false, code: "NETWORK_ERROR" });
    renderForgot();

    await continueWith("ana@example.com");
    await setPassword("new-password-1");

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't reach the server");
  });

  it("has Back links on both steps", async () => {
    const { onBack } = renderForgot();

    await continueWith("ana@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Reset password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.com");

    await userEvent.click(screen.getByRole("button", { name: "Back to log in" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
