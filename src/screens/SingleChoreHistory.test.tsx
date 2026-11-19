// One chore's history (SCRUM-45 View Single Chore History for Household).
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chore } from "../chores.ts";
import SingleChoreHistory from "./SingleChoreHistory.tsx";

const { getChoreHistory } = vi.hoisted(() => ({ getChoreHistory: vi.fn() }));
vi.mock("../api/chores.ts", () => ({ getChoreHistory }));

// Thursday, Nov 12 2026, noon on the phone.
const NOW = new Date(2026, 10, 12, 12);
const at = (day: string, hour: number) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!, hour).toISOString();
};

const ana = { userId: "u-ana", name: "Ana Lopez" };
const sam = { userId: "u-sam", name: "Sam Ito" };

const chore: Chore = {
  id: "c1",
  name: "Mop kitchen",
  notes: null,
  dueDate: "2026-11-06",
  assignee: ana,
  createdBy: sam,
  createdAt: at("2026-11-01", 9),
  completedAt: at("2026-11-08", 11),
  completedBy: ana,
};

// As the server records them: every event carries the chore's due date at that moment.
const history = [
  { id: "e1", eventType: "created", dueDate: "2026-11-05", actor: sam, createdAt: at("2026-11-01", 9) },
  { id: "e2", eventType: "due_date_changed", dueDate: "2026-11-06", actor: sam, createdAt: at("2026-11-03", 13) },
  { id: "e3", eventType: "completed", dueDate: "2026-11-06", actor: ana, createdAt: at("2026-11-08", 11) },
] as const;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  getChoreHistory.mockResolvedValue({ ok: true, chore, history });
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("Single chore history", { tags: ["SCRUM-45"] }, () => {
  it("AC2: shows when the chore was created, its due dates, completions and who completed it", async () => {
    render(<SingleChoreHistory choreId="c1" userId="u-ana" />);

    const events = within(await screen.findByRole("list", { name: "Chore activity" })).getAllByRole("listitem");
    // Newest first; only a change of due date says "New due date".
    expect(events.map((event) => event.textContent)).toEqual([
      "Marked doneSun, Nov 8 at 11:00 AM by YouDue Fri, Nov 6",
      "Due date changedTue, Nov 3 at 1:00 PM by Sam ItoNew due date Fri, Nov 6",
      "CreatedSun, Nov 1 at 9:00 AM by Sam ItoDue Thu, Nov 5",
    ]);
    expect(screen.getByText("Status").nextElementSibling).toHaveTextContent("Done late");
  });
});
