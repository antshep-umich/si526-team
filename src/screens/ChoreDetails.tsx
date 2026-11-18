import { useEffect, useState } from "react";
import { getChore } from "../api/chores.ts";
import type { Household } from "../api/households.ts";
import Button from "../components/Button.tsx";
import ThemedIcon from "../components/ThemedIcon.tsx";
import type { Chore } from "../chores.ts";
import { localDateOf, today as localToday } from "../dates.ts";
import { statusLabel } from "../history.ts";
import styles from "./ChoreDetails.module.css";

// One chore's details and description (Jira SCRUM-53 View chore details & description;
// Figma "Home - Chore Details", 634:192). Opened by selecting a chore on Home.
// The chore is loaded fresh, so one deleted since the list loaded shows
// "Chore no longer available." instead of stale details.

type ChoreDetailsProps = {
  household: Household;
  userId: string;
  choreId: string;
  /** Back to the screen the chore was opened from. */
  onBack: () => void;
};

type State = { status: "loading" } | { status: "gone" } | { status: "failed" } | { status: "ready"; chore: Chore };

/** "October 5, 2026", as in the Figma frame. */
function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function ChoreDetails({ household, userId, choreId, onBack }: ChoreDetailsProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getChore(choreId).then((result) => {
      if (cancelled) return;
      if (result.ok) setState({ status: "ready", chore: result.chore });
      else setState({ status: result.code === "CHORE_NOT_FOUND" ? "gone" : "failed" });
    });
    return () => {
      cancelled = true;
    };
  }, [choreId, attempt]);

  const person = (who: { userId: string; name: string } | null) =>
    !who ? "Someone who left" : who.userId === userId ? "You" : who.name;

  function body() {
    if (state.status === "loading") {
      // Not in Figma yet (placeholder): the loading state.
      return (
        <p className={styles.message} role="status">
          Loading chore…
        </p>
      );
    }
    if (state.status === "gone") {
      return (
        <p className={styles.message} role="alert">
          Chore no longer available.
        </p>
      );
    }
    if (state.status === "failed") {
      // Not in Figma yet (placeholder): the load error.
      return (
        <div className={styles.failed}>
          <p className={styles.message} role="alert">
            Couldn't load this chore.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </div>
      );
    }

    const { chore } = state;
    const today = localToday();
    // Not in Figma yet: Status. The frame has no completion status, which the story asks for.
    const status = chore.completedAt
      ? `${statusLabel(chore, today)} · ${longDate(localDateOf(chore.completedAt))}`
      : statusLabel(chore, today);
    const fields: [string, string][] = [
      ["Assigned to", person(chore.assignee)],
      ["Due date", longDate(chore.dueDate)],
      ["Status", status],
    ];
    return (
      <dl className={styles.fields}>
        {fields.map(([label, value]) => (
          <div key={label} className={styles.field}>
            <dt className={styles.label}>{label}</dt>
            <dd className={styles.box}>{value}</dd>
          </div>
        ))}
        <div className={styles.field}>
          <dt className={styles.label}>Notes</dt>
          <dd className={`${styles.box} ${styles.notes} ${chore.notes ? "" : styles.empty}`}>
            {chore.notes ?? "No description added."}
          </dd>
        </div>
      </dl>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.back} aria-label="Back" onClick={onBack}>
          <ThemedIcon name="chevronLeft" />
        </button>
        <div className={styles.titles}>
          <p className={styles.overline}>{household.name}</p>
          <h1 className={styles.title}>{state.status === "ready" ? state.chore.name : "Chore details"}</h1>
        </div>
      </div>
      {body()}
    </main>
  );
}
