// Which screen App shows, from the session and the household (src/App.tsx).
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Household } from "./api/households.ts";
import App from "./App.tsx";
import { pendingInviteCode, takeInviteCodeFromAddress } from "./inviteLink.ts";

const {
  useSession,
  signIn,
  signOut,
  getCurrentHousehold,
  createHousehold,
  joinHousehold,
  resetPassword,
  listChores,
  createChore,
  listChoreHistory,
  getChore,
  getChoreHistory,
} = vi.hoisted(() => ({
  useSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getCurrentHousehold: vi.fn(),
  createHousehold: vi.fn(),
  joinHousehold: vi.fn(),
  resetPassword: vi.fn(),
  listChores: vi.fn(),
  createChore: vi.fn(),
  listChoreHistory: vi.fn(),
  getChore: vi.fn(),
  getChoreHistory: vi.fn(),
}));
vi.mock("./auth.ts", () => ({
  authClient: { useSession, signOut, signIn: { email: signIn }, signUp: { email: vi.fn() } },
}));
vi.mock("./api/households.ts", () => ({ getCurrentHousehold, createHousehold, joinHousehold }));
vi.mock("./api/passwordReset.ts", () => ({ resetPassword }));
vi.mock("./api/chores.ts", () => ({
  listChores,
  createChore,
  completeChore: vi.fn(),
  undoChore: vi.fn(),
  listChoreHistory,
  getChore,
  getChoreHistory,
}));

const household: Household = {
  id: "h1",
  name: "Maple St House",
  inviteCode: "K7Q2MXAB",
  assignmentMethod: null,
  createdAt: "2026-10-17T00:00:00.000Z",
  role: "owner",
  members: [{ userId: "u-ana", name: "Ana Lopez", role: "owner", joinedAt: "2026-10-17T00:00:00.000Z" }],
};

const signedIn = { data: { user: { id: "u-ana", name: "Ana Lopez", email: "ana@example.com" } }, isPending: false };
const signedOut = { data: null, isPending: false };

/**
 * A session that changes like Better Auth's: signing in or out updates every
 * component using it. The stand-in signIn and signOut switch it.
 */
function liveSession(initial: typeof signedIn | typeof signedOut) {
  let current: typeof signedIn | typeof signedOut = initial;
  const listeners = new Set<() => void>();
  const set = (next: typeof current) => {
    current = next;
    for (const listener of listeners) listener();
  };
  useSession.mockImplementation(() =>
    useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => current,
    ),
  );
  signIn.mockImplementation(async () => {
    set(signedIn);
    return { data: {}, error: null };
  });
  signOut.mockImplementation(async () => set(signedOut));
}

beforeEach(() => {
  for (const mock of [
    useSession,
    signIn,
    signOut,
    getCurrentHousehold,
    createHousehold,
    joinHousehold,
    resetPassword,
    listChores,
    createChore,
    listChoreHistory,
    getChore,
    getChoreHistory,
  ]) {
    mock.mockReset();
  }
  listChores.mockResolvedValue({ ok: true, chores: [] });
  listChoreHistory.mockResolvedValue({ ok: true, chores: [] });
  sessionStorage.clear();
});

/** Opens the app the way an invite link does: /join/<code> in the address bar. */
function arriveByInviteLink(code = "K7Q2MXAB") {
  window.history.replaceState(null, "", `/join/${code}`);
  takeInviteCodeFromAddress();
}

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
    // No tab bar or menu until there's a household for them to show.
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Menu" })).not.toBeInTheDocument();
  });

  it("keeps the tab bar and the menu on every screen in the household, without Back links; Chores returns to the chore list", async () => {
    const chore = {
      id: "c1",
      name: "Mop kitchen",
      notes: null,
      dueDate: "2999-01-01",
      assignee: { userId: "u-ana", name: "Ana Lopez" },
      createdBy: { userId: "u-ana", name: "Ana Lopez" },
      createdAt: "2026-10-29T16:00:00.000Z",
      completedAt: null,
      completedBy: null,
    };
    listChores.mockResolvedValue({ ok: true, chores: [chore] });
    getChoreHistory.mockResolvedValue({ ok: true, chore, history: [] });
    getChore.mockResolvedValue({ ok: true, chore });
    getCurrentHousehold.mockResolvedValue({ ok: true, household });
    render(<App />);
    await screen.findByRole("heading", { name: "Maple St House" });

    const fromMenu = (item: string) => async () => {
      await userEvent.click(screen.getByRole("button", { name: "Menu" }));
      await userEvent.click(screen.getByRole("menuitem", { name: item }));
    };
    const screens = [
      ["Add chore", () => userEvent.click(screen.getByRole("button", { name: "Add chore" }))],
      ["My chore history", fromMenu("My chore history")],
      ["Household chore history", fromMenu("Household chore history")],
      ["Mop kitchen", () => userEvent.click(screen.getByRole("button", { name: /^Mop kitchen/ }))],
      ["Mop kitchen", () => userEvent.click(screen.getByRole("button", { name: "View history for Mop kitchen" }))],
    ] as const;

    for (const [heading, open] of screens) {
      await open();
      expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
      expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Chores" })).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Back/ })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Chores" }));
      expect(await screen.findByRole("heading", { name: "Maple St House" })).toBeInTheDocument();
    }
  });

  it("opens the menu's screens from any screen, closing the menu even on the screen already showing", async () => {
    getCurrentHousehold.mockResolvedValue({ ok: true, household });
    render(<App />);
    await screen.findByRole("heading", { name: "Maple St House" });
    await userEvent.click(screen.getByRole("button", { name: "Add chore" }));
    await screen.findByRole("heading", { name: "Add chore" });

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Household chore history" }));
    expect(await screen.findByRole("heading", { name: "Household chore history" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Household chore history" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Household chore history" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "My chore history" }));
    expect(await screen.findByRole("heading", { name: "My chore history" })).toBeInTheDocument();
  });

  it("moves between the Chores and House tabs; House returns from a profile to the House page", async () => {
    getCurrentHousehold.mockResolvedValue({ ok: true, household });
    render(<App />);
    await screen.findByRole("heading", { name: "Maple St House" });

    await userEvent.click(screen.getByRole("button", { name: "House" }));
    await userEvent.click(await screen.findByRole("button", { name: "Ana Lopez (You)" }));
    expect(screen.getByRole("heading", { level: 1, name: "Ana Lopez" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "House" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Back/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "House" }));
    expect(await screen.findByRole("button", { name: "Invite housemates" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Chores" }));
    expect(await screen.findByRole("radiogroup", { name: "Show chores" })).toBeInTheDocument();
    // Schedule has no screen yet.
    expect(screen.getByRole("button", { name: "Schedule" })).toHaveAttribute("aria-disabled", "true");
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

  it("forgets the Mine filter on log out", async () => {
    getCurrentHousehold.mockResolvedValue({ ok: true, household });
    render(<App />);

    await userEvent.click(await screen.findByRole("radio", { name: "Mine" }));
    expect(sessionStorage.getItem("jaals.choreFilter")).toBe("mine");
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(sessionStorage.getItem("jaals.choreFilter")).toBeNull();
  });
});

// Acceptance criteria that run across screens, so they're proved here. The story's
// own screen tests (SignUp, LogIn, Home, AddChore, …) prove the rest.
describe("App acceptance criteria", () => {
  const newChore = {
    id: "c1",
    name: "Mop kitchen",
    notes: null,
    dueDate: "2999-01-01",
    assignee: { userId: "u-ana", name: "Ana Lopez" },
    createdBy: { userId: "u-ana", name: "Ana Lopez" },
    createdAt: "2026-10-29T16:00:00.000Z",
    completedAt: null,
    completedBy: null,
  };

  async function openChoreList() {
    useSession.mockReturnValue(signedIn);
    getCurrentHousehold.mockResolvedValue({ ok: true, household });
    render(<App />);
    await screen.findByRole("heading", { name: "Maple St House" });
  }

  async function openYourHousehold() {
    useSession.mockReturnValue(signedIn);
    getCurrentHousehold.mockResolvedValue({ ok: false, code: "NO_HOUSEHOLD" });
    render(<App />);
    await screen.findByRole("heading", { name: "Your household" });
  }

  describe("Sign up", { tags: ["SCRUM-2"] }, () => {
    it('AC5: "Already have an account? Log in" opens the Log in screen', async () => {
      useSession.mockReturnValue(signedOut);
      render(<App />);
      await userEvent.click(screen.getByRole("button", { name: "New here? Create an account" }));

      await userEvent.click(screen.getByRole("button", { name: "Already have an account? Log in" }));

      expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    });
  });

  describe("Log in and log out", { tags: ["SCRUM-3"] }, () => {
    async function logIn() {
      liveSession(signedOut);
      render(<App />);
      await userEvent.type(screen.getByLabelText("Email"), "ana@example.com");
      await userEvent.type(screen.getByLabelText("Password"), "correct-horse-1");
      await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    }

    it("AC2: logging in opens the Chore List when the user belongs to a household", async () => {
      getCurrentHousehold.mockResolvedValue({ ok: true, household });

      await logIn();

      expect(await screen.findByRole("heading", { name: "Maple St House" })).toBeInTheDocument();
      expect(screen.getByRole("radiogroup", { name: "Show chores" })).toBeInTheDocument();
    });

    it('AC2: logging in opens "Your household" when the user has none', async () => {
      getCurrentHousehold.mockResolvedValue({ ok: false, code: "NO_HOUSEHOLD" });

      await logIn();

      expect(await screen.findByRole("heading", { name: "Your household" })).toBeInTheDocument();
    });

    it('AC4: "Forgot your password?" opens the password reset flow', async () => {
      useSession.mockReturnValue(signedOut);
      render(<App />);

      await userEvent.click(screen.getByRole("button", { name: "Forgot your password?" }));

      expect(screen.getByRole("heading", { name: "Reset password" })).toBeInTheDocument();
    });

    it('AC5: "Log out" in the header menu ends the session and opens the Log in screen', async () => {
      liveSession(signedIn);
      getCurrentHousehold.mockResolvedValue({ ok: true, household });
      render(<App />);

      await userEvent.click(await screen.findByRole("button", { name: "Menu" }));
      await userEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

      expect(signOut).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    });
  });

  describe("Joining a household", { tags: ["SCRUM-32"] }, () => {
    it('AC1: "Join with a code" opens "Join a household" with one field, Invite code', async () => {
      await openYourHousehold();

      await userEvent.click(screen.getByRole("button", { name: "Join with a code" }));

      expect(screen.getByRole("heading", { name: "Join a household" })).toBeInTheDocument();
      expect(screen.getAllByRole("textbox")).toEqual([screen.getByLabelText("Invite code")]);
    });

    it('AC3: joining with a valid code opens the Chore List and shows "You joined [Household name]."', async () => {
      joinHousehold.mockResolvedValue({ ok: true, household });
      await openYourHousehold();
      await userEvent.click(screen.getByRole("button", { name: "Join with a code" }));

      await userEvent.type(screen.getByLabelText("Invite code"), "k7q2mxab");
      await userEvent.click(screen.getByRole("button", { name: "Join" }));

      expect(await screen.findByRole("heading", { name: "Maple St House" })).toBeInTheDocument();
      expect(screen.getByRole("radiogroup", { name: "Show chores" })).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("You joined Maple St House.");
    });

    it('AC4: "Back" returns to "Your household"', async () => {
      await openYourHousehold();
      await userEvent.click(screen.getByRole("button", { name: "Join with a code" }));

      await userEvent.click(screen.getByRole("button", { name: "Back" }));

      expect(screen.getByRole("heading", { name: "Your household" })).toBeInTheDocument();
    });
  });

  describe("Add a chore", { tags: ["SCRUM-6"] }, () => {
    it('AC1: "Add chore" opens the form with the household name above the title and the four fields', async () => {
      await openChoreList();

      await userEvent.click(screen.getByRole("button", { name: "Add chore" }));

      const title = screen.getByRole("heading", { name: "Add chore" });
      const householdName = screen.getByText("Maple St House");
      expect(householdName.compareDocumentPosition(title)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(screen.getByLabelText("Chore name")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Assigned to" })).toBeInTheDocument();
      expect(screen.getByLabelText("Due date")).toBeInTheDocument();
      expect(screen.getByLabelText("Notes (optional)")).toBeInTheDocument();
    });

    it("AC4: saving opens the Chore List with the new chore in it", async () => {
      listChores.mockResolvedValueOnce({ ok: true, chores: [] }).mockResolvedValue({ ok: true, chores: [newChore] });
      createChore.mockResolvedValue({ ok: true, chore: newChore });
      await openChoreList();
      await userEvent.click(screen.getByRole("button", { name: "Add chore" }));

      await userEvent.type(screen.getByLabelText("Chore name"), "Mop kitchen");
      await userEvent.click(screen.getByRole("combobox", { name: "Assigned to" }));
      await userEvent.click(screen.getByRole("option", { name: "You" }));
      fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2999-01-01" } });
      await userEvent.click(screen.getByRole("button", { name: "Add chore" }));

      expect(createChore).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole("heading", { name: "Maple St House" })).toBeInTheDocument();
      expect(await screen.findByText("Mop kitchen")).toBeInTheDocument();
    });

    it('AC5: "Cancel" returns to the Chore List without saving', async () => {
      await openChoreList();
      await userEvent.click(screen.getByRole("button", { name: "Add chore" }));
      await userEvent.type(screen.getByLabelText("Chore name"), "Mop kitchen");

      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(await screen.findByRole("heading", { name: "Maple St House" })).toBeInTheDocument();
      expect(createChore).not.toHaveBeenCalled();
    });
  });

  describe("View a chore list", { tags: ["SCRUM-7"] }, () => {
    it('AC1: the "Chores" tab shows the chore list', async () => {
      await openChoreList();

      expect(screen.getByRole("button", { name: "Chores" })).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("radio", { name: "All" })).toBeChecked();
    });

    it('AC9: "Add chore" opens the "Add chore" screen', async () => {
      await openChoreList();

      await userEvent.click(screen.getByRole("button", { name: "Add chore" }));

      expect(screen.getByRole("heading", { name: "Add chore" })).toBeInTheDocument();
    });
  });

  describe("Chore details", { tags: ["SCRUM-53"] }, () => {
    // Back is the Chores tab, as on every screen in a household (README Conflicts row 33).
    it("AC3: Back returns to the previous screen: the Chores tab returns to the chore list as it was", async () => {
      const chore = {
        id: "c1",
        name: "Mop kitchen",
        notes: null,
        dueDate: "2999-01-01",
        assignee: { userId: "u-ana", name: "Ana Lopez" },
        createdBy: { userId: "u-ana", name: "Ana Lopez" },
        createdAt: "2026-10-29T16:00:00.000Z",
        completedAt: null,
        completedBy: null,
      };
      listChores.mockResolvedValue({ ok: true, chores: [chore] });
      getChore.mockResolvedValue({ ok: true, chore });
      await openChoreList();
      await userEvent.click(await screen.findByRole("radio", { name: "Mine" }));

      await userEvent.click(await screen.findByRole("button", { name: /^Mop kitchen/ }));
      expect(await screen.findByText("No description added.")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Chores" }));

      expect(await screen.findByRole("heading", { level: 1, name: "Maple St House" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Mine" })).toBeChecked();
      expect(await screen.findByRole("button", { name: /^Mop kitchen/ })).toBeInTheDocument();
    });
  });

  describe("House page", { tags: ["SCRUM-74"] }, () => {
    const housemates: Household = {
      ...household,
      members: [...household.members, { userId: "u-sam", name: "Sam Ito", role: "member", joinedAt: "2026-10-18T00:00:00.000Z" }],
    };

    it('AC1: opening the "House" tab shows the household name, member count and housemates, with the user labeled You', async () => {
      useSession.mockReturnValue(signedIn);
      getCurrentHousehold.mockResolvedValue({ ok: true, household: housemates });
      render(<App />);
      await screen.findByRole("heading", { name: "Maple St House" });

      await userEvent.click(screen.getByRole("button", { name: "House" }));

      expect(await screen.findByText("2 members")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1, name: "Maple St House" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "House" })).toHaveAttribute("aria-current", "page");
      const rows = screen.getAllByRole("listitem");
      expect(rows.map((row) => row.textContent)).toEqual(["ALAna LopezYou", "SISam Ito"]);
    });

    it("AC2: selecting a housemate opens their profile", async () => {
      useSession.mockReturnValue(signedIn);
      getCurrentHousehold.mockResolvedValue({ ok: true, household: housemates });
      render(<App />);
      await screen.findByRole("heading", { name: "Maple St House" });
      await userEvent.click(screen.getByRole("button", { name: "House" }));

      await userEvent.click(await screen.findByRole("button", { name: "Sam Ito" }));

      expect(screen.getByRole("heading", { level: 1, name: "Sam Ito" })).toBeInTheDocument();
      expect(screen.getByText("Profiles are coming soon.")).toBeInTheDocument();
    });
  });
});

describe("App with an invite link", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("opens Join with the code filled in for someone without a household; joining forgets the code", async () => {
    useSession.mockReturnValue(signedIn);
    getCurrentHousehold.mockResolvedValue({ ok: false, code: "NO_HOUSEHOLD" });
    joinHousehold.mockResolvedValue({ ok: true, household });
    arriveByInviteLink();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Join a household" })).toBeInTheDocument();
    expect(screen.getByLabelText("Invite code")).toHaveValue("K7Q2MXAB");
    expect(joinHousehold).not.toHaveBeenCalled(); // nobody joins without tapping Join
    expect(window.location.pathname).toBe("/");

    await userEvent.click(screen.getByRole("button", { name: "Join" }));

    expect(joinHousehold).toHaveBeenCalledWith("K7Q2MXAB");
    expect(await screen.findByRole("status")).toHaveTextContent("You joined Maple St House.");
    expect(pendingInviteCode()).toBeNull();
  });

  it("keeps the code through Log in", async () => {
    liveSession(signedOut);
    getCurrentHousehold.mockResolvedValue({ ok: false, code: "NO_HOUSEHOLD" });
    arriveByInviteLink();
    render(<App />);

    await userEvent.type(screen.getByLabelText("Email"), "ana@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse-1");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("heading", { name: "Join a household" })).toBeInTheDocument();
    expect(screen.getByLabelText("Invite code")).toHaveValue("K7Q2MXAB");
  });

  it("is dropped for someone already in a household, and on Back from Join", async () => {
    useSession.mockReturnValue(signedIn);
    getCurrentHousehold.mockResolvedValue({ ok: true, household });
    arriveByInviteLink();
    const { unmount } = render(<App />);

    expect(await screen.findByRole("radiogroup", { name: "Show chores" })).toBeInTheDocument();
    expect(pendingInviteCode()).toBeNull();
    unmount();

    getCurrentHousehold.mockResolvedValue({ ok: false, code: "NO_HOUSEHOLD" });
    arriveByInviteLink();
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));

    expect(screen.getByRole("heading", { name: "Your household" })).toBeInTheDocument();
    expect(pendingInviteCode()).toBeNull();
  });
});
