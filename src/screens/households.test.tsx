// ChooseHousehold, CreateHousehold, JoinHousehold and HouseholdCreated (SCRUM-4 and SCRUM-5).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Household } from "../api/households.ts";
import ChooseHousehold from "./ChooseHousehold.tsx";
import CreateHousehold from "./CreateHousehold.tsx";
import HouseholdCreated from "./HouseholdCreated.tsx";
import JoinHousehold from "./JoinHousehold.tsx";

const { createHousehold, joinHousehold } = vi.hoisted(() => ({
  createHousehold: vi.fn(),
  joinHousehold: vi.fn(),
}));
vi.mock("../api/households.ts", () => ({ createHousehold, joinHousehold }));

const household: Household = {
  id: "h1",
  name: "Maple St House",
  inviteCode: "K7Q2MXAB",
  createdAt: "2026-10-17T00:00:00.000Z",
  role: "owner",
  members: [
    { userId: "u-ana", name: "Ana Lopez", role: "owner", joinedAt: "2026-10-17T00:00:00.000Z" },
    { userId: "u-ben", name: "Ben Ito", role: "member", joinedAt: "2026-10-17T00:01:00.000Z" },
  ],
};

beforeEach(() => {
  createHousehold.mockReset();
  joinHousehold.mockReset();
});

describe("ChooseHousehold", () => {
  it("offers Create and Join", async () => {
    const onCreate = vi.fn();
    const onJoin = vi.fn();
    render(<ChooseHousehold onCreate={onCreate} onJoin={onJoin} />);

    await userEvent.click(screen.getByRole("button", { name: "Create a household" }));
    await userEvent.click(screen.getByRole("button", { name: "Join with a code" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onJoin).toHaveBeenCalledTimes(1);
  });
});

describe("CreateHousehold", () => {
  async function submit(name: string) {
    if (name) await userEvent.type(screen.getByLabelText("Household Name"), name);
    await userEvent.click(screen.getByRole("button", { name: "Create a household" }));
  }

  it("asks for a name before calling the server", async () => {
    render(<CreateHousehold onCreated={() => {}} onBack={() => {}} />);

    await submit("   ");

    expect(screen.getByLabelText("Household Name")).toHaveAccessibleDescription("Please enter a household name.");
    expect(createHousehold).not.toHaveBeenCalled();
  });

  it("rejects a name over 60 characters", async () => {
    render(<CreateHousehold onCreated={() => {}} onBack={() => {}} />);

    await submit("x".repeat(61));

    expect(screen.getByLabelText("Household Name")).toHaveAccessibleDescription(
      "That name is too long. Use 60 characters or fewer.",
    );
  });

  it("creates the household with the trimmed name and hands it on", async () => {
    createHousehold.mockResolvedValue({ ok: true, household });
    const onCreated = vi.fn();
    render(<CreateHousehold onCreated={onCreated} onBack={() => {}} />);

    await submit("  Maple St House ");

    expect(createHousehold).toHaveBeenCalledWith("Maple St House");
    expect(onCreated).toHaveBeenCalledWith(household);
  });

  it("explains when the user is already in a household", async () => {
    createHousehold.mockResolvedValue({ ok: false, code: "ALREADY_IN_HOUSEHOLD" });
    render(<CreateHousehold onCreated={() => {}} onBack={() => {}} />);

    await submit("Maple St House");

    expect(screen.getByRole("alert")).toHaveTextContent("You're already in a household");
  });

  it("goes Back", async () => {
    const onBack = vi.fn();
    render(<CreateHousehold onCreated={() => {}} onBack={onBack} />);

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe("JoinHousehold", () => {
  async function join(code: string) {
    if (code) await userEvent.type(screen.getByLabelText("Invite code"), code);
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
  }

  it("asks for a code before calling the server", async () => {
    render(<JoinHousehold onJoined={() => {}} onBack={() => {}} />);

    await join("");

    expect(screen.getByLabelText("Invite code")).toHaveAccessibleDescription("Enter an invite code.");
    expect(joinHousehold).not.toHaveBeenCalled();
  });

  it("sends the code as typed (the server tidies it) and hands the household on", async () => {
    joinHousehold.mockResolvedValue({ ok: true, household });
    const onJoined = vi.fn();
    render(<JoinHousehold onJoined={onJoined} onBack={() => {}} />);

    await join("k7q2-mxab");

    expect(joinHousehold).toHaveBeenCalledWith("k7q2-mxab");
    expect(onJoined).toHaveBeenCalledWith(household);
  });

  it.each([
    ["INVITE_CODE_NOT_FOUND", "We couldn't find a household with that code. Check with your housemate and try again."],
    ["ALREADY_IN_HOUSEHOLD", "You're already in a different household."],
  ])("shows %s on the field", async (code, message) => {
    joinHousehold.mockResolvedValue({ ok: false, code });
    render(<JoinHousehold onJoined={() => {}} onBack={() => {}} />);

    await join("ZZZZZZZZ");

    expect(screen.getByLabelText("Invite code")).toHaveAccessibleDescription(message);
  });

  it("shows any other failure as a server error under the button (SCRUM-32)", async () => {
    joinHousehold.mockResolvedValue({ ok: false, code: "NETWORK_ERROR" });
    render(<JoinHousehold onJoined={() => {}} onBack={() => {}} />);

    await join("ZZZZZZZZ");

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
  });
});

describe("HouseholdCreated", () => {
  it("shows the household, its invite code and its members", () => {
    render(<HouseholdCreated household={household} userId="u-ana" onContinue={() => {}} />);

    expect(screen.getByRole("heading", { name: "Household Created!" })).toBeInTheDocument();
    expect(screen.getByText(/Maple St House is ready/)).toBeInTheDocument();
    expect(screen.getByText("K7Q2MXAB")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Members (2)" })).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("YouOwner");
    expect(rows[1]).toHaveTextContent("Ben Ito");
    expect(rows[1]).not.toHaveTextContent("Owner");
  });

  it("copies the invite code and confirms it", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<HouseholdCreated household={household} userId="u-ana" onContinue={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Copy code" }));

    expect(writeText).toHaveBeenCalledWith("K7Q2MXAB");
    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument();
  });

  it("explains how to copy by hand when the clipboard isn't available", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    render(<HouseholdCreated household={household} userId="u-ana" onContinue={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Copy code" }));

    expect(screen.getByRole("status")).toHaveTextContent("Couldn't copy automatically");
  });

  it("goes to the household", async () => {
    const onContinue = vi.fn();
    render(<HouseholdCreated household={household} userId="u-ana" onContinue={onContinue} />);

    await userEvent.click(screen.getByRole("button", { name: "Go to household" }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
