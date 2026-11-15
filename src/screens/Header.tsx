import { createContext, useContext, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import ThemedIcon from "../components/ThemedIcon.tsx";
import styles from "./Header.module.css";

// The header of every screen in a household: an optional overline, the title, and the
// menu button on the title's right (Figma "Home - Header menu"). The menu opens as a
// dropdown list (README Conflicts row 29). TabLayout provides what its items do, so
// screens don't pass them around; outside a household the header has no menu.

export type MenuActions = {
  /** Opens My chore history (SCRUM-44). */
  onChoreHistory: () => void;
  /** Opens Household chore history (SCRUM-46, 47). */
  onHouseholdChoreHistory: () => void;
  onLogOut: () => void;
};

const MenuContext = createContext<MenuActions | null>(null);

export function MenuProvider({ actions, children }: { actions: MenuActions; children: ReactNode }) {
  return <MenuContext.Provider value={actions}>{children}</MenuContext.Provider>;
}

type HeaderProps = {
  /** Small capitals above the title, such as the household's name. */
  overline?: string;
  title: string;
  /** Anything under the title, such as a chore's notes. */
  children?: ReactNode;
};

export default function Header({ overline, title, children }: HeaderProps) {
  return (
    <header className={styles.header}>
      {overline && <p className={styles.overline}>{overline}</p>}
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{title}</h1>
        <Menu />
      </div>
      {children}
    </header>
  );
}

/** The menu button and its dropdown list. Nothing outside a household. */
function Menu() {
  const actions = useContext(MenuContext);
  const [open, setOpen] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close on a tap outside or the Escape key (focus goes back to the menu button);
  // focus the first item when it opens.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector("button")?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!areaRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!actions) return null;

  // Close first: the item may be the screen that's already showing.
  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  // Up and down arrows (and Home / End) move between the items, as in any menu.
  const moveFocus = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === "ArrowDown" ? (at + 1) % items.length
      : e.key === "ArrowUp" ? (at - 1 + items.length) % items.length
      : e.key === "Home" ? 0
      : e.key === "End" ? items.length - 1
      : null;
    if (next === null) {
      if (e.key === "Tab") setOpen(false);
      return;
    }
    e.preventDefault();
    items[next]?.focus();
  };

  return (
    <div className={styles.menuArea} ref={areaRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.menuButton}
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <ThemedIcon name="menu" />
      </button>
      {open && (
        // Not in Figma yet: the designs show Log out alone, as a button (SCRUM-44 and 46 need a way in).
        <div className={styles.menu} role="menu" aria-label="Menu" ref={listRef} onKeyDown={moveFocus}>
          <button type="button" role="menuitem" className={styles.item} onClick={choose(actions.onChoreHistory)}>
            My chore history
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={choose(actions.onHouseholdChoreHistory)}>
            Household chore history
          </button>
          <div role="separator" className={styles.separator} />
          <button
            type="button"
            role="menuitem"
            className={`${styles.item} ${styles.logOut}`}
            onClick={choose(actions.onLogOut)}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
