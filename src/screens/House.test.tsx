// The House tab (SCRUM-74, src/screens/House.tsx). Opening it from the tab bar and opening a
// housemate's profile are tested through App (src/App.test.tsx).
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Household } from "../api/households.ts";
import { ToastProvider } from "../components/Toast.tsx";
import { POLL_INTERVAL_MS } from "../usePolling.ts";
import House from "./House.tsx";

const { getCurrentHousehold } = vi.hoisted(() => ({ getCurrentHousehold: vi.fn() }));
vi.mock("../api/households.ts", () => ({ getCurrentHousehold }));

const member = (userId: string, name: string) => ({
  userId,
  name,
  role: "member" as const,
  joinedAt: "2026-10-17T00:00:00.000Z",
});

const household: Household = {
  id: "h1",
  name: "Maple St House",
  inviteCode: "K7Q2MXAB",
  createdAt: "2026-10-17T00:00:00.000Z",
  role: "member",
  members: [member("u-sam", "Sam Ito"), member("u-ana", "Ana Lopez"), member("u-priya", "Priya Shah")],
};

function renderHouse() {
  const onOpenHousemate = vi.fn();
  render(
    <ToastProvider>
      <House userId="u-ana" onOpenHousemate={onOpenHousemate} />
    </ToastProvider>,
  );
  return { onOpenHousemate };
}

const housemates = () => screen.getByRole("list");

beforeEach(() => {
  getCurrentHousehold.mockReset();
  getCurrentHousehold.mockResolvedValue({ ok: true, household });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("House page", { tags: ["SCRUM-74"] }, () => {
  it("AC1: shows the household name, member count, and each housemate with initials and name; the user is labeled You", async () => {
    renderHouse();

    expect(await screen.findByRole("heading", { level: 1, name: "Maple St House" })).toBeInTheDocument();
    expect(screen.getByText("3 members")).toBeInTheDocument();
    const rows = within(housemates()).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual(["ALAna LopezYou", "SISam Ito", "PSPriya Shah"]);
    expect(within(rows[0]!).getByRole("img", { name: "Ana Lopez" })).toHaveTextContent("AL");
  });

  it("AC1: says 1 member for a household of one", async () => {
    getCurrentHousehold.mockResolvedValue({ ok: true, household: { ...household, members: [member("u-ana", "Ana Lopez")] } });
    renderHouse();

    expect(await screen.findByText("1 member")).toBeInTheDocument();
  });

  it("AC2: selecting a housemate opens their profile", async () => {
    const { onOpenHousemate } = renderHouse();

    await userEvent.click(await screen.findByRole("button", { name: "Sam Ito" }));

    expect(onOpenHousemate).toHaveBeenCalledWith(member("u-sam", "Sam Ito"));
  });

  // Skipped until SCRUM-62 adds the button (AC3's note, README Conflicts row 30). Run it then.
  it.skip('AC3: with no manager, the card shows "No Household Manager assigned" and a "Become household manager" button', async () => {
    renderHouse();

    const card = await screen.findByRole("region", { name: "Household manager" });
    expect(card).toHaveTextContent("No Household Manager assigned");
    expect(within(card).getByRole("button", { name: "Become household manager" })).toBeInTheDocument();
  });

  it('shows "No Household Manager assigned" on the manager card until there are managers', async () => {
    renderHouse();

    expect(await screen.findByRole("region", { name: "Household manager" })).toHaveTextContent(
      "Household managerNo Household Manager assigned",
    );
  });

  it("gives no one the Household manager chip while there are no managers", async () => {
    renderHouse();

    await screen.findByRole("list");
    expect(within(housemates()).queryByText("Household manager")).not.toBeInTheDocument();
  });

  it('AC4: "Invite housemates" shows the invite code with a share button', async () => {
    renderHouse();

    await userEvent.click(await screen.findByRole("button", { name: "Invite housemates" }));

    const card = screen.getByRole("region", { name: "Invite code" });
    expect(card).toHaveTextContent("K7Q2MXAB");
    expect(within(card).getByRole("button", { name: "Share invite link" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite housemates" })).not.toBeInTheDocument();
  });

  it("AC4: sharing opens the share sheet with the household's /join link", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share, clipboard: navigator.clipboard });
    renderHouse();

    await userEvent.click(await screen.findByRole("button", { name: "Invite housemates" }));
    await userEvent.click(screen.getByRole("button", { name: "Share invite link" }));

    expect(share).toHaveBeenCalledWith({
      title: "Join Maple St House",
      text: "Join Maple St House on JAALS Chore Tracker.",
      url: `${window.location.origin}/join/K7Q2MXAB`,
    });
  });

  it("does nothing when the share sheet is closed", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("Share canceled", "AbortError"));
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, share, clipboard: { writeText } });
    renderHouse();

    await userEvent.click(await screen.findByRole("button", { name: "Invite housemates" }));
    await userEvent.click(screen.getByRole("button", { name: "Share invite link" }));

    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it('AC5: without a share sheet, the link is copied and "Invite link copied." shows', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });
    renderHouse();

    await userEvent.click(await screen.findByRole("button", { name: "Invite housemates" }));
    await userEvent.click(screen.getByRole("button", { name: "Share invite link" }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/K7Q2MXAB`);
    expect(screen.getByRole("status")).toHaveTextContent("Invite link copied.");
  });

  it("AC6: has no way to leave the household (that's on the profile page)", async () => {
    renderHouse();
    await screen.findByRole("list");
    await userEvent.click(screen.getByRole("button", { name: "Invite housemates" }));

    expect(screen.queryByRole("button", { name: /leave/i })).not.toBeInTheDocument();
  });

  it('AC7: when the page fails to load, says so with a "Retry" button that loads it again', async () => {
    getCurrentHousehold.mockResolvedValueOnce({ ok: false, code: "NETWORK_ERROR" });
    renderHouse();

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load your household. Please try again.");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Maple St House" })).toBeInTheDocument();
  });

  it("shows housemates who join without a refresh, and keeps the page as it is when a check fails", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    renderHouse();
    await screen.findByRole("list");
    await userEvent.click(screen.getByRole("button", { name: "Invite housemates" }));

    getCurrentHousehold.mockResolvedValueOnce({ ok: false, code: "NETWORK_ERROR" });
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("3 members")).toBeInTheDocument();

    getCurrentHousehold.mockResolvedValueOnce({
      ok: true,
      household: { ...household, members: [...household.members, member("u-jo", "Jo Park")] },
    });
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    expect(screen.getByText("4 members")).toBeInTheDocument();
    expect(within(housemates()).getByRole("button", { name: "Jo Park" })).toBeInTheDocument();
    // The invite card stays open: nothing reloads in front of the user.
    expect(screen.getByRole("region", { name: "Invite code" })).toBeInTheDocument();
  });
});
