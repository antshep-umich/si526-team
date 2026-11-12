import { useEffect, useState } from "react";
import { listChores } from "../api/chores.ts";
import Button from "../components/Button.tsx";
import ChoreCard from "../components/ChoreCard.tsx";
import { choreStatus, type Chore } from "../chores.ts";
import { addMonths, formatMonth, startOfMonth, today as localToday } from "../dates.ts";
import { choresDueInMonth, monthlyDetails, monthSummary } from "../monthlyHistory.ts";
import styles from "./HouseholdChoreHistory.module.css";

// The monthly view of Household chore history (Jira SCRUM-47). Not in Figma yet: it
// reuses the weekly view's layout (SCRUM-46) so the two views read as one screen.

type Props = {
  userId: string;
  /** The first day of the month shown, "YYYY-MM-01". Kept by the parent so it survives opening a chore. */
  month: string;
  onMonthChange: (month: string) => void;
  /** Opens a chore's details and description. */
  onOpenChore: (choreId: string) => void;
};

type ListState = { status: "loading" } | { status: "failed" } | { status: "ready"; chores: Chore[] };

export default function MonthlyChoreHistory({ userId, month, onMonthChange, onOpenChore }: Props) {
  const today = localToday();
  const currentMonth = startOfMonth(today);
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setList({ status: "loading" });

    // The API returns everything due since the 1st; choresDueInMonth drops later months.
    listChores(month).then((result) => {
      if (cancelled) return;
      setList(result.ok ? { status: "ready", chores: result.chores } : { status: "failed" });
    });

    return () => {
      cancelled = true;
    };
  }, [month, attempt]);

  const chores = list.status === "ready" ? choresDueInMonth(list.chores, month) : [];
  const summary = monthSummary(chores, today);

  return (
    <>
      <section className={styles.week} aria-label="Month">
        <div className={styles.weekNavigation}>
          <Button variant="outline" aria-label="Previous month" onClick={() => onMonthChange(addMonths(month, -1))}>
            Previous
          </Button>
          <div className={styles.weekLabel} aria-live="polite">
            <strong>{formatMonth(month)}</strong>
            {month === currentMonth && <span>Current month</span>}
          </div>
          <Button variant="outline" aria-label="Next month" onClick={() => onMonthChange(addMonths(month, 1))}>
            Next
          </Button>
        </div>
        <Button variant="outline" fullWidth onClick={() => onMonthChange(currentMonth)}>
          Go to current month
        </Button>
      </section>

      {list.status === "loading" && (
        <p className={styles.message} role="status">
          Loading household chore history…
        </p>
      )}

      {list.status === "failed" && (
        <div className={styles.failed}>
          <p className={styles.message} role="alert">
            Couldn't load household chore history.
          </p>
          <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </Button>
        </div>
      )}

      {list.status === "ready" &&
        (chores.length === 0 ? (
          <p className={styles.message}>No chores this month.</p>
        ) : (
          <>
            <section className={styles.summary} aria-label="Monthly chore summary">
              <div>
                <strong>{summary.completed}</strong>
                <span>Completed</span>
              </div>
              <div>
                <strong>{summary.incomplete}</strong>
                <span>Incomplete</span>
              </div>
              <div>
                <strong>{summary.overdue}</strong>
                <span>Overdue</span>
              </div>
            </section>

            <section className={styles.chores}>
              <h2 id="monthly-chores">Chores this month</h2>
              <ul className={styles.list} aria-labelledby="monthly-chores">
                {chores.map((chore) => (
                  <li key={chore.id}>
                    <ChoreCard
                      name={chore.name}
                      details={monthlyDetails(chore, userId, today)}
                      status={choreStatus(chore, today)}
                      onViewHistory={() => onOpenChore(chore.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          </>
        ))}
    </>
  );
}
