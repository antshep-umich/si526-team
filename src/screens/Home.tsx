import { useId, useState } from "react";
import type { Household } from "../api/households.ts";
import Button from "../components/Button.tsx";
import Collapse from "../components/Collapse.tsx";
import DoneSection from "../components/DoneSection.tsx";
import ProgressCard from "../components/ProgressCard.tsx";
import TabFilter from "../components/TabFilter.tsx";
import ThemedIcon from "../components/ThemedIcon.tsx";
import { CHORE_FILTERS, saveChoreFilter, savedChoreFilter, type ChoreFilter } from "../choreFilter.ts";
import { doneThisWeek, isMine, openChores, weeklyProgress, type Chore } from "../chores.ts";
import { startOfWeek, today as localToday } from "../dates.ts";
import { useChoreList } from "../useChoreList.ts";
import ChoreItem from "./ChoreItem.tsx";
import Header from "./Header.tsx";
import styles from "./Home.module.css";

// The chore list, the home screen after log in (Figma "Home - Chores (All)";
// SCRUM-7 View the Chore List and SCRUM-8 Mark a Chore Done). The header menu
// (Header.tsx) and the tab bar (TabLayout) are on every screen in a household.

type HomeProps = {
  household: Household;
  userId: string;
  onAddChore: () => void;
  /** Opens Edit chore from the pencil in a chore's dropdown (owner or creator only). */
  onEditChore: (chore: Chore) => void;
  /** Opens one chore's history (SCRUM-45), from "View history" in its dropdown. */
  onOpenChore: (choreId: string) => void;
};

export default function Home({
  household,
  userId,
  onAddChore,
  onEditChore,
  onOpenChore,
}: HomeProps) {
  const today = localToday();
  const { list, retry, toggle, saving, toggleError } = useChoreList(startOfWeek(today));
  const [filter, setFilter] = useState<ChoreFilter>(savedChoreFilter);
  const [doneOpen, setDoneOpen] = useState(false);
  const doneListId = useId();

  function changeFilter(next: ChoreFilter) {
    setFilter(next);
    saveChoreFilter(next);
  }

  function card(chore: Chore) {
    return (
      <li key={chore.id}>
        <ChoreItem
          chore={chore}
          household={household}
          userId={userId}
          today={today}
          onToggle={toggle}
          busy={saving.has(chore.id)}
          onEditChore={onEditChore}
          onOpenChore={onOpenChore}
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
          <Button variant="outline" onClick={retry}>
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
            {/* One item on the page, so a closed list leaves no gap below the toggle. */}
            <div>
              <DoneSection
                count={done.length}
                expanded={doneOpen}
                onToggle={() => setDoneOpen(!doneOpen)}
                controls={doneListId}
              />
              <Collapse open={doneOpen} id={doneListId}>
                <ul className={`${styles.list} ${styles.doneList}`} aria-label="Done chores">
                  {done.map(card)}
                </ul>
              </Collapse>
            </div>
          </>
        )}
      </>
    );
  }

  // The week's progress is the whole household's, whichever filter is on.
  const progress = list.status === "ready" ? weeklyProgress(list.chores, today) : null;

  return (
    <main className={styles.page}>
      <Header title={household.name} />
      {progress && <ProgressCard {...progress} />}
      <Button fullWidth onClick={onAddChore}>
        Add chore
      </Button>
      <TabFilter label="Show chores" options={CHORE_FILTERS} selected={filter} onSelect={changeFilter} />
      {body()}
    </main>
  );
}
