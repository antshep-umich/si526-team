// Light or dark mode: the phone's setting ("system", the default) or the user's own
// choice from the Appearance section of their profile. Kept in this browser only, like
// most appearance settings; each device keeps its own (Anthony, 2026-11-19).
// tokens.css and base.css follow <html data-theme="light|dark"> when it's set.

export type ThemeChoice = "system" | "light" | "dark";

const KEY = "jaals.theme";

/** The saved choice, or "system" when there's none (or storage is blocked). */
export function savedTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

/** Shows the app in this mode. "system" hands it back to the phone's setting. */
export function applyTheme(choice: ThemeChoice, root: HTMLElement = document.documentElement): void {
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
}

/** Applies the choice and remembers it for next time. */
export function setTheme(choice: ThemeChoice): void {
  applyTheme(choice);
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Storage blocked: the choice still applies until the page is reloaded.
  }
}
