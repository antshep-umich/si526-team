import { useCallback, useEffect, useId, useRef, useState } from "react";
import { completeChore, listChores, undoChore } from "../api/chores.ts";
import type { Household } from "../api/households.ts";
import Button from "../components/Button.tsx";
import ChoreCard from "../components/ChoreCard.tsx";
import DoneSection from "../components/DoneSection.tsx";
import ProgressCard from "../components/ProgressCard.tsx";
import TabBar from "../components/TabBar.tsx";
import TabFilter from "../components/TabFilter.tsx";
import ThemedIcon from "../components/ThemedIcon.tsx";
import {
  choreDetails,
  choreStatus,
  doneThisWeek,
  isMine,
  openChores,
  weeklyProgress,
  type Chore,
} from "../chores.ts";
import { startOfWeek, today as localToday } from "../dates.ts";
import styles from "./Home.module.css";

// The chore list, the home screen after log in (Figma "Home - Chores (All)";
// SCRUM-7 View the Chore List and SCRUM-8 Mark a Chore Done). The header menu
// holds Log out (SCRUM-3).

type HomeProps = {
  household: Household;
  userId: string;
  onAddChore: () => void;
  onLogOut: () => void;
};

type Filter = "all" | "mine";
const FILTERS = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
] as const;

// "The filter stays selected until changed or until log out": kept for the browser
// tab's session and cleared by forgetChoreFilter() when the user logs out.
const FILTER_KEY = "jaals.choreFilter";

function savedFilter(): Filter {
  try {
    return sessionStorage.getItem(FILTER_KEY) === "mine" ? "mine" : "all";
  } catch {
    return "all";
  }
}

function saveFilter(filter: Filter) {
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

type ListState = { status: "loading" } | { status: "failed" } | { status: "ready"; chores: Chore[] };

export default function Home({ household, userId, onAddChore, onLogOut }: HomeProps) {
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<Filter>(savedFilter);
  const [doneOpen, setDoneOpen] = useState(false);
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  const [toggleError, setToggleError] = useState<string | null>(null);
  const doneListId = useId();
  const today = localToday();

  useEffect(() => {
    let cancelled = false;
    listChores(startOfWeek(localToday())).then((result) => {
      if (cancelled) return;
      setList(result.ok ? { status: "ready", chores: result.chores } : { status: "failed" });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const replaceChore = useCallback((chore: Chore) => {
    setList((current) =>
      current.status === "ready"
        ? { status: "ready", chores: current.chores.map((c) => (c.id === chore.id ? chore : c)) }
        : current,
    );
  }, []);

  // Ticks or unticks right away, then saves. If saving fails, the checkbox goes back.
  async function toggle(chore: Chore) {
    const undoing = chore.completedAt !== null;
    setToggleError(null);
    setSaving((ids) => new Set(ids).add(chore.id));
    replaceChore(
      undoing
        ? { ...chore, completedAt: null, completedBy: null }
        : { ...chore, completedAt: new Date().toISOString(), completedBy: chore.assignee },
    );

    const result = await (undoing ? undoChore(chore.id) : completeChore(chore.id));
    replaceChore(result.ok ? result.chore : chore);
    if (!result.ok) setToggleError("Couldn't update this chore. Please try again.");
    setSaving((ids) => {
      const next = new Set(ids);
      next.delete(chore.id);
      return next;
    });
  }

  function changeFilter(next: Filter) {
    setFilter(next);
    saveFilter(next);
  }

  function card(chore: Chore) {
    return (
      <li key={chore.id}>
        <ChoreCard
          name={chore.name}
          details={choreDetails(chore, userId, today)}
          status={choreStatus(chore, today)}
          // SCRUM-8: only the assignee can mark it done or undo it.
          onToggle={isMine(chore, userId) ? () => toggle(chore) : undefined}
          busy={saving.has(chore.id)}
        />
      </li>
    );
  }

  function body() {
    if (list.status === "loading") {
      // Not in Figma yet (placeholder): the loading indicator.
      return (
        <p className={styles.message} role="status">
          Loading chores…
        </p>
      );
    }
    if (list.status === "failed") {
      // Not in Figma yet (placeholder): the load error.
      return (
        <div className={styles.failed}>
          <p className={styles.message} role="alert">
            Couldn't load chores.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setList({ status: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </div>
      );
    }

    const shown = filter === "mine" ? list.chores.filter((chore) => isMine(chore, userId)) : list.chores;
    const open = openChores(shown, today);
    const done = doneThisWeek(shown, today);
    const emptyMessage =
      filter === "mine"
        ? open.length === 0 && "Nothing assigned to you right now."
        : open.length === 0 && done.length === 0 && "No chores yet. Add the first one.";

    return (
      <>
        {toggleError && (
          // Not in Figma yet (placeholder): the update error, until messages are designed.
          <p className={styles.toggleError} role="alert">
            <ThemedIcon name="alert" />
            {toggleError}
          </p>
        )}
        {emptyMessage && <p className={styles.message}>{emptyMessage}</p>}
        {open.length > 0 && (
          <ul className={styles.list} aria-label="Chores to do">
            {open.map(card)}
          </ul>
        )}
        {done.length > 0 && (
          <>
            <DoneSection
              count={done.length}
              expanded={doneOpen}
              onToggle={() => setDoneOpen(!doneOpen)}
              controls={doneListId}
            />
            <ul id={doneListId} className={styles.list} aria-label="Done chores" hidden={!doneOpen}>
              {done.map(card)}
            </ul>
          </>
        )}
      </>
    );
  }

  // The week's progress is the whole household's, whichever filter is on.
  const progress = list.status === "ready" ? weeklyProgress(list.chores, today) : null;

  return (
    <div className={styles.screen}>
      <main className={styles.page}>
        <Header name={household.name} onLogOut={onLogOut} />
        {progress && <ProgressCard {...progress} />}
        <Button fullWidth onClick={onAddChore}>
          Add chore
        </Button>
        <TabFilter label="Show chores" options={FILTERS} selected={filter} onSelect={changeFilter} />
        {body()}
      </main>
      <div className={styles.tabBar}>
        <TabBar selected="chores" onSelect={() => {}} available={["chores"]} />
      </div>
    </div>
  );
}

/** The household name and the menu with Log out (Figma "Home - Header menu" / "Home - Menu open"). */
function Header({ name, onLogOut }: { name: string; onLogOut: () => void }) {
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
    <div className={styles.header} ref={headerRef}>
      <h1 className={styles.title}>{name}</h1>
      <button
        type="button"
        className={styles.menuButton}
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <ThemedIcon name="menu" />
      </button>
      {menuOpen && (
        <div className={styles.menu} role="menu" ref={menuRef}>
          <Button role="menuitem" onClick={onLogOut}>
            Log out
          </Button>
        </div>
      )}
    </div>
  );
}
