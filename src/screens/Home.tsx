import { useEffect, useRef, useState } from "react";
import type { Household } from "../api/households.ts";
import Button from "../components/Button.tsx";
import styles from "./Home.module.css";

// SCRUM-3 Log in and Log out: the household home with its header menu (Figma
// "Home - Header menu" and "Home - Menu open"). Chores come in a later story,
// so the list is always the empty state for now.

type HomeProps = {
  household: Household;
  onLogOut: () => void;
};

export default function Home({ household, onLogOut }: HomeProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu on a tap outside it or the Escape key; focus its first item when it opens.
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector("button")?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <main className={styles.page}>
      <div className={styles.header} ref={headerRef}>
        <h1 className={styles.title}>{household.name}</h1>
        <button
          type="button"
          className={styles.menuButton}
          aria-label="Menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className={styles.menuIcon} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
        {menuOpen && (
          <div className={styles.menu} role="menu" ref={menuRef}>
            <Button role="menuitem" onClick={onLogOut}>
              Log out
            </Button>
          </div>
        )}
      </div>
      <p className={styles.empty}>No chores yet. Add the first one.</p>
    </main>
  );
}
