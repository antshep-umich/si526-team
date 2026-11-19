// User profile page (SCRUM-72).
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Household } from "../api/households.ts";
import Profile, { NOT_SAVED } from "./Profile.tsx";

const { useSession, updateUser, getChorePreferences, saveChorePreferences, saveAssignmentMethod, getCurrentHousehold, showToast } =
  vi.hoisted(() => ({
    useSession: vi.fn(),
    updateUser: vi.fn(),
    getChorePreferences: vi.fn(),
    saveChorePreferences: vi.fn(),
    saveAssignmentMethod: vi.fn(),
    getCurrentHousehold: vi.fn(),
    showToast: vi.fn(),
  }));
vi.mock("../auth.ts", () => ({ authClient: { useSession, updateUser } }));
vi.mock("../api/preferences.ts", () => ({ getChorePreferences, saveChorePreferences, saveAssignmentMethod }));
vi.mock("../api/households.ts", () => ({ getCurrentHousehold }));
vi.mock("../components/Toast.tsx", () => ({ useToast: () => showToast }));

const household: Household = {
  id: "h1",
  name: "Maple St House",
  inviteCode: "K7Q2MXAB",
  createdAt: "2026-10-17T00:00:00.000Z",
  role: "owner",
  assignmentMethod: null,
  members: [{ userId: "u-sarah", name: "Sarah Cameron", role: "owner", joinedAt: "2026-10-17T00:00:00.000Z" }],
};

const saved = { choreTypes: ["dishes"], weeklyWorkload: "medium" };

function renderProfile(overrides: Partial<Household> = {}) {
  const onHouseholdChange = vi.fn();
  render(<Profile household={{ ...household, ...overrides }} onHouseholdChange={onHouseholdChange} />);
  return { onHouseholdChange };
}

const section = (name: string) => screen.getByRole("region", { name });
const chore = (name: string) => within(section("Set chore preferences")).getByRole("button", { name });
const method = (name: string) => screen.getByRole("radio", { name });

beforeEach(() => {
  vi.resetAllMocks();
  useSession.mockReturnValue({ data: { user: { id: "u-sarah", name: "Sarah Cameron", email: "sarah.cameron@gmail.com" } } });
  getChorePreferences.mockResolvedValue({ ok: true, preferences: saved });
});

describe("Profile information", { tags: ["SCRUM-72"] }, () => {
  it("AC1: shows the user's name and email", () => {
    renderProfile();
    const info = section("Profile Information");

    expect(within(info).getByText("Sarah Cameron", { selector: "dd" })).toBeInTheDocument();
    expect(within(info).getByText("sarah.cameron@gmail.com")).toBeInTheDocument();
  });

  it("AC2, AC7: edits the name, saves it and says \"Profile updated successfully.\"", async () => {
    updateUser.mockResolvedValue({ data: { status: true }, error: null });
    getCurrentHousehold.mockResolvedValue({ ok: true, household });
    const { onHouseholdChange } = renderProfile();

    await userEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    const field = screen.getByLabelText("Name");
    expect(field).toHaveValue("Sarah Cameron");
    await userEvent.clear(field);
    await userEvent.type(field, "  Sarah C.  ");
    await userEvent.click(within(section("Profile Information")).getByRole("button", { name: "Save" }));

    expect(updateUser).toHaveBeenCalledWith({ name: "Sarah C." });
    expect(showToast).toHaveBeenCalledWith("Profile updated successfully.");
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(onHouseholdChange).toHaveBeenCalledWith(household);
  });

  it("AC8, AC15: Cancel discards the edit and keeps the saved name", async () => {
    renderProfile();

    await userEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Someone Else");
    await userEvent.click(within(section("Profile Information")).getByRole("button", { name: "Cancel" }));

    expect(updateUser).not.toHaveBeenCalled();
    expect(screen.getByText("Sarah Cameron", { selector: "dd" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Sarah Cameron");
  });

  it("AC13: a blank name shows \"Name is required.\" and isn't saved", async () => {
    renderProfile();

    await userEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "   ");
    await userEvent.click(within(section("Profile Information")).getByRole("button", { name: "Save" }));

    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("shows the story's message when the name can't be saved", async () => {
    updateUser.mockResolvedValue({ data: null, error: { code: "INTERNAL", message: "" } });
    renderProfile();

    await userEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    await userEvent.click(within(section("Profile Information")).getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent(NOT_SAVED);
    expect(showToast).not.toHaveBeenCalled();
  });
});

describe("Set chore preferences", { tags: ["SCRUM-72"] }, () => {
  it("AC3, AC6, AC9: shows the chore choices and workload, with the saved ones selected", async () => {
    renderProfile();

    expect(await screen.findByRole("button", { name: "Dishes", pressed: true })).toBeInTheDocument();
    for (const name of ["Laundry", "Vacuuming", "Trash & recycling", "Bathroom", "Yard Work", "Cooking", "Mopping"]) {
      expect(chore(name)).toHaveAttribute("aria-pressed", "false");
    }
    expect(screen.getByRole("combobox", { name: "Weekly workload" })).toHaveTextContent("Medium (3-4 chores)");
  });

  it("AC5, AC10: saves the selected preferences and confirms", async () => {
    saveChorePreferences.mockResolvedValue({
      ok: true,
      preferences: { choreTypes: ["dishes", "laundry"], weeklyWorkload: "light" },
    });
    renderProfile();

    await userEvent.click(await screen.findByRole("button", { name: "Laundry" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Weekly workload" }));
    await userEvent.click(screen.getByRole("option", { name: "Light (1-2 chores)" }));
    await userEvent.click(within(section("Set chore preferences")).getByRole("button", { name: "Save" }));

    expect(saveChorePreferences).toHaveBeenCalledWith({ choreTypes: ["dishes", "laundry"], weeklyWorkload: "light" });
    expect(showToast).toHaveBeenCalledWith("Chore preferences saved.");
    expect(chore("Laundry")).toHaveAttribute("aria-pressed", "true");
  });

  it("AC14: a failed save says \"Changes not saved. Please try again.\" and keeps the choices", async () => {
    saveChorePreferences.mockResolvedValue({ ok: false, code: "NETWORK_ERROR" });
    renderProfile();

    await userEvent.click(await screen.findByRole("button", { name: "Bathroom" }));
    await userEvent.click(within(section("Set chore preferences")).getByRole("button", { name: "Save" }));

    expect(within(section("Set chore preferences")).getByRole("alert")).toHaveTextContent(NOT_SAVED);
    expect(chore("Bathroom")).toHaveAttribute("aria-pressed", "true");
    expect(showToast).not.toHaveBeenCalled();
  });

  it("AC8, AC15: Cancel goes back to the saved preferences", async () => {
    renderProfile();

    await userEvent.click(await screen.findByRole("button", { name: "Cooking" }));
    await userEvent.click(chore("Dishes"));
    await userEvent.click(within(section("Set chore preferences")).getByRole("button", { name: "Cancel" }));

    expect(chore("Dishes")).toHaveAttribute("aria-pressed", "true");
    expect(chore("Cooking")).toHaveAttribute("aria-pressed", "false");
    expect(saveChorePreferences).not.toHaveBeenCalled();
  });

  it("offers Try again when the preferences can't be loaded", async () => {
    getChorePreferences.mockResolvedValueOnce({ ok: false, code: "NETWORK_ERROR" });
    renderProfile();

    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("button", { name: "Dishes", pressed: true })).toBeInTheDocument();
  });
});

describe("Set household manager preferences", { tags: ["SCRUM-72"] }, () => {
  it("AC4, AC11: shows the three ways chores can be assigned, with the saved one checked", () => {
    renderProfile({ assignmentMethod: "rotate" });

    expect(method("Rotate evenly")).toBeChecked();
    expect(method("Match preferences")).not.toBeChecked();
    expect(method("Manager assigns")).toHaveAccessibleDescription("The household manager picks chores by hand.");
  });

  it("AC12: the owner saves a method and sees a confirmation", async () => {
    const updated = { ...household, assignmentMethod: "preferences" as const };
    saveAssignmentMethod.mockResolvedValue({ ok: true, household: updated });
    const { onHouseholdChange } = renderProfile();

    await userEvent.click(method("Match preferences"));
    await userEvent.click(within(section("Set household manager preferences")).getByRole("button", { name: "Save" }));

    expect(saveAssignmentMethod).toHaveBeenCalledWith("preferences");
    expect(onHouseholdChange).toHaveBeenCalledWith(updated);
    expect(showToast).toHaveBeenCalledWith("Household preferences saved.");
  });

  it("AC14: a failed save says \"Changes not saved. Please try again.\"", async () => {
    saveAssignmentMethod.mockResolvedValue({ ok: false, code: "NETWORK_ERROR" });
    renderProfile();

    await userEvent.click(method("Manager assigns"));
    await userEvent.click(within(section("Set household manager preferences")).getByRole("button", { name: "Save" }));

    expect(within(section("Set household manager preferences")).getByRole("alert")).toHaveTextContent(NOT_SAVED);
  });

  it("AC15: Cancel goes back to the saved method", async () => {
    renderProfile({ assignmentMethod: "manager" });

    await userEvent.click(method("Rotate evenly"));
    await userEvent.click(within(section("Set household manager preferences")).getByRole("button", { name: "Cancel" }));

    expect(method("Manager assigns")).toBeChecked();
    expect(saveAssignmentMethod).not.toHaveBeenCalled();
  });

  it("members who aren't the owner can see the method but not change it", () => {
    renderProfile({ role: "member", assignmentMethod: "rotate" });
    const managerSection = section("Set household manager preferences");

    expect(method("Rotate evenly")).toBeChecked();
    expect(method("Match preferences")).toBeDisabled();
    expect(within(managerSection).queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(within(managerSection).getByText("Only the household owner can change this.")).toBeInTheDocument();
    expect(screen.getByText("Household Member")).toBeInTheDocument();
  });
});
