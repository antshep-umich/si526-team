import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Button from "../components/Button.tsx";
import ThemedIcon from "../components/ThemedIcon.tsx";
import styles from "./HouseholdMenu.module.css";

// The header menu (Figma "Home - Header menu" / "Home - Menu open"), on every screen in a
// household: each screen's title has the menu button on its right. TabLayout provides
// what the items do, so screens don't pass them around.

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

/** A screen's title (the h1) with the menu button on its right. Just the title outside a household. */
export function TitleWithMenu({ children }: { children: ReactNode }) {
  const actions = useContext(MenuContext);
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu on a tap outside it or the Escape key; focus its first item when it opens.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector("button")?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!actions) return children;

  // Close first: the item may be the screen that's already showing.
  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className={styles.row} ref={rowRef}>
      {children}
      <button
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
        <div className={styles.menu} role="menu" ref={menuRef}>
          <Button role="menuitem" onClick={choose(actions.onLogOut)}>
            Log out
          </Button>
          {/* Not in Figma yet: the menu only has Log out in the designs (SCRUM-44 needs a way in). */}
          <Button role="menuitem" variant="outline" onClick={choose(actions.onChoreHistory)}>
            My chore history
          </Button>
          <Button role="menuitem" variant="outline" onClick={choose(actions.onHouseholdChoreHistory)}>
            Household chore history
          </Button>
        </div>
      )}
    </div>
  );
}
