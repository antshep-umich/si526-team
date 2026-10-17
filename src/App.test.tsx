// Which screen App shows, from the session and the household (src/App.tsx).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Household } from "./api/households.ts";
import App from "./App.tsx";

const { useSession, signOut, getCurrentHousehold, createHousehold, joinHousehold, resetPassword } = vi.hoisted(
  () => ({
    useSession: vi.fn(),
    signOut: vi.fn(),
    getCurrentHousehold: vi.fn(),
    createHousehold: vi.fn(),
    joinHousehold: vi.fn(),
    resetPassword: vi.fn(),
  }),
);
vi.mock("./auth.ts", () => ({
  authClient: { useSession, signOut, signIn: { email: vi.fn() }, signUp: { email: vi.fn() } },
}));
vi.mock("./api/households.ts", () => ({ getCurrentHousehold, createHousehold, joinHousehold }));
vi.mock("./api/passwordReset.ts", () => ({ resetPassword }));

const household: Household = {
  id: "h1",
  name: "Maple St House",
  inviteCode: "K7Q2MXAB",
  createdAt: "2026-10-17T00:00:00.000Z",
  role: "owner",
  members: [{ userId: "u-ana", name: "Ana Lopez", role: "owner", joinedAt: "2026-10-17T00:00:00.000Z" }],
};

const signedIn = { data: { user: { id: "u-ana", name: "Ana Lopez", email: "ana@example.com" } }, isPending: false };
const signedOut = { data: null, isPending: false };

beforeEach(() => {
  for (const mock of [useSession, signOut, getCurrentHousehold, createHousehold, joinHousehold, resetPassword]) {
    mock.mockReset();
  }
});

describe("App when signed out", () => {
  beforeEach(() => {
    useSession.mockReturnValue(signedOut);
  });

  it("shows Loading while the session is checked", () => {
    useSession.mockReturnValue({ data: null, isPending: true });
    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("starts on Log in and moves between Log in and Sign up", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "New here? Create an account" }));
    expect(screen.getByRole("heading", { name: "Create Account" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Already have an account? Log in" }));
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("returns to Log in after a password reset, with the email filled in and a notice", async () => {
    resetPassword.mockResolvedValue({ ok: true });
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Forgot your password?" }));
    await userEvent.type(screen.getByLabelText("Email"), "ana@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.type(screen.getByLabelText("New password"), "new-password-1");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "new-password-1");
    await userEvent.click(screen.getByRole("button", { name: "Save new password" }));

    expect(await screen.findByText("Password updated. Log in with your new password.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.com");
  });
});

describe("App when signed in", () => {
  beforeEach(() => {
    useSession.mockReturnValue(signedIn);
  });

  it("goes to Home when the user has a household", async () => {
    getCurrentHousehold.mockResolvedValue({ ok: true, household });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Maple St House" })).toBeInTheDocument();
  });

  it("offers Create or Join when the user has no household", async () => {
    getCurrentHousehold.mockResolvedValue({ ok: false, code: "NO_HOUSEHOLD" });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Your household" })).toBeInTheDocument();
  });

  it("creates a household, shows Household Created!, then goes Home", async () => {
    getCurrentHousehold.mockResolvedValue({ ok: false, code: "NO_HOUSEHOLD" });
    createHousehold.mockResolvedValue({ ok: true, household });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Create a household" }));
    await userEvent.type(screen.getByLabelText("Household Name"), "Maple St House");
    await userEvent.click(screen.getByRole("button", { name: "Create a household" }));
    expect(await screen.findByRole("heading", { name: "Household Created!" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Go to household" }));
    expect(screen.getByRole("heading", { name: "Maple St House" })).toBeInTheDocument();
  });

  it("joins a household with a code and goes Home", async () => {
    getCurrentHousehold.mockResolvedValue({ ok: false, code: "NO_HOUSEHOLD" });
    joinHousehold.mockResolvedValue({ ok: true, household });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Join with a code" }));
    await userEvent.type(screen.getByLabelText("Invite code"), "K7Q2MXAB");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));

    expect(await screen.findByRole("heading", { name: "Maple St House" })).toBeInTheDocument();
  });

  it("can go Back from Create and Join to the choice", async () => {
    getCurrentHousehold.mockResolvedValue({ ok: false, code: "NO_HOUSEHOLD" });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Join with a code" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "Create a household" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByRole("heading", { name: "Your household" })).toBeInTheDocument();
  });

  it("offers Try again and Log out when the household can't be loaded", async () => {
    getCurrentHousehold
      .mockResolvedValueOnce({ ok: false, code: "NETWORK_ERROR" })
      .mockResolvedValueOnce({ ok: true, household });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Maple St House" })).toBeInTheDocument();
  });

  it("logs out from the Home menu", async () => {
    getCurrentHousehold.mockResolvedValue({ ok: true, household });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
