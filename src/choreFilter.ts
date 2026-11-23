// All | Mine, shared by the Chore List and the Schedule (SCRUM-7 AC9, SCRUM-73 AC7): one
// choice for both tabs. "The filter stays selected until changed or until log out": kept
// for the browser tab's session and cleared by forgetChoreFilter() when the user logs out.

export type ChoreFilter = "all" | "mine";

export const CHORE_FILTERS = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
] as const;

const FILTER_KEY = "jaals.choreFilter";

export function savedChoreFilter(): ChoreFilter {
  try {
    return sessionStorage.getItem(FILTER_KEY) === "mine" ? "mine" : "all";
  } catch {
    return "all";
  }
}

export function saveChoreFilter(filter: ChoreFilter) {
  try {
    sessionStorage.setItem(FILTER_KEY, filter);
  } catch {
    // Storage blocked: the filter still works, it just isn't remembered.
  }
}

export function forgetChoreFilter() {
  try {
    sessionStorage.removeItem(FILTER_KEY);
  } catch {
    // Nothing was stored.
  }
}
