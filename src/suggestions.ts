import type { HouseholdMember } from "../shared/api.ts";
import type { ChoreType } from "../shared/preferences.ts";
import type { PickerOption } from "./components/PickerField.tsx";
import type { Chore } from "./chores.ts";

// SCRUM-64 Preference based chore assignment suggestion: who Add chore and Edit chore's
// "Assigned to" suggests. A housemate prefers a chore when its Category is one of their
// chore types (SCRUM-61 and SCRUM-72; README Conflicts rows 46 and 51).

/** Each housemate's open chores, leaving out the chore being edited. */
export function openChoreCounts(chores: readonly Chore[], exceptChoreId?: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const chore of chores) {
    if (chore.completedAt || !chore.assignee || chore.id === exceptChoreId) continue;
    counts.set(chore.assignee.userId, (counts.get(chore.assignee.userId) ?? 0) + 1);
  }
  return counts;
}

const openChores = (count: number) => `${count} open ${count === 1 ? "chore" : "chores"}`;

/**
 * "Assigned to"'s options: you first as "You", then housemates in the order they joined.
 * With a category that someone prefers, and the open-chore counts (null when they couldn't
 * load), those people come first under "Suggested", most open chores first (Anthony,
 * 2026-11-22; SCRUM-64 AC1 says fewest), and everyone else under "Everyone else". Anyone can
 * still be picked.
 */
export function assigneeOptions(
  members: readonly HouseholdMember[],
  userId: string,
  category: ChoreType | null,
  counts: Map<string, number> | null,
): PickerOption[] {
  const me = members.filter((member) => member.userId === userId);
  const ordered = [...me, ...members.filter((member) => member.userId !== userId)];
  const label = (member: HouseholdMember) => (member.userId === userId ? "You" : member.name);

  const prefer = category && counts ? ordered.filter((member) => member.choreTypes.includes(category)) : [];
  if (prefer.length === 0) return ordered.map((member) => ({ value: member.userId, label: label(member) }));

  const count = (member: HouseholdMember) => counts?.get(member.userId) ?? 0;
  // sort is stable, so equal counts keep "You" first and then the joining order.
  const suggested = [...prefer].sort((a, b) => count(b) - count(a));
  return [
    ...suggested.map((member) => ({
      value: member.userId,
      label: label(member),
      detail: `Prefers this chore · ${openChores(count(member))}`,
      group: "Suggested",
    })),
    ...ordered
      .filter((member) => !prefer.includes(member))
      .map((member) => ({ value: member.userId, label: label(member), group: "Everyone else" })),
  ];
}
