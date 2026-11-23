import type { Household } from "../api/households.ts";
import ChoreCard, { type ChoreCardPanel } from "../components/ChoreCard.tsx";
import { choreDetails, choreStatus, isMine, type Chore } from "../chores.ts";
import { describeDay, formatDate, localDateOf } from "../dates.ts";
import { statusLabel } from "../history.ts";
import { canEditChore } from "../../shared/chores.ts";

// One chore in a list, as the Chore List (SCRUM-7, 8) and the Schedule (SCRUM-73) show it:
// the chore card with its checkbox for the assignee and its dropdown of details (SCRUM-53).

export type ChoreItemProps = {
  chore: Chore;
  household: Household;
  userId: string;
  today: string;
  /** Marks it done or undoes it. Only offered to the assignee (SCRUM-8). */
  onToggle: (chore: Chore) => void;
  busy: boolean;
  /** Opens Edit chore from the pencil (owner, creator, or anyone while unassigned). */
  onEditChore: (chore: Chore) => void;
  /** Opens the chore's history (SCRUM-45), from "View history". */
  onOpenChore: (choreId: string) => void;
};

export default function ChoreItem({ chore, household, userId, today, onToggle, busy, onEditChore, onOpenChore }: ChoreItemProps) {
  const person = (who: { userId: string; name: string } | null) =>
    !who ? "Someone who left" : who.userId === userId ? "You" : who.name;

  /**
   * The dropdown (SCRUM-7 AC11 and SCRUM-53; Figma "Schedule", 837:1483): Figma's
   * "Assigned To:" and "Chore Details:", with the due date, status and "Last done" the
   * stories ask for. The pencil only for those who may edit it.
   */
  const rows: [string, string][] = [
    ["Assigned To:", chore.assignee ? person(chore.assignee) : "Unassigned"],
    ["Due date:", formatDate(chore.dueDate, today)],
    ["Status:", statusLabel(chore, today)],
  ];
  if (chore.completedAt) {
    rows.push(["Last done:", `${describeDay(localDateOf(chore.completedAt), today)} by ${person(chore.completedBy)}`]);
  }
  rows.push(["Chore Details:", chore.notes ?? "No description added."]);
  const editable = canEditChore(
    { creatorId: chore.createdBy?.userId ?? null, assigneeId: chore.assignee?.userId ?? null },
    { userId, role: household.role },
  );
  const panel: ChoreCardPanel = {
    rows,
    onEdit: editable ? () => onEditChore(chore) : undefined,
    onViewHistory: () => onOpenChore(chore.id),
  };

  return (
    <ChoreCard
      name={chore.name}
      details={choreDetails(chore, userId, today)}
      status={choreStatus(chore, today)}
      onToggle={isMine(chore, userId) ? () => onToggle(chore) : undefined}
      busy={busy}
      panel={panel}
    />
  );
}
