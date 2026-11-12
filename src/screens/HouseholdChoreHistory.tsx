
import { useEffect, useState } from "react";
import { listChores } from "../api/chores.ts";
import type { Household } from "../api/households.ts";
import Button from "../components/Button.tsx";
import ChoreCard from "../components/ChoreCard.tsx";
import TabFilter from "../components/TabFilter.tsx";
import TextLink from "../components/TextLink.tsx";
import { choreDetails, choreStatus, type Chore } from "../chores.ts";
import { addDays, formatDate, localDateOf, startOfMonth, startOfWeek, today as localToday } from "../dates.ts";
import MonthlyChoreHistory from "./MonthlyChoreHistory.tsx";
import SingleChoreHistory from "./SingleChoreHistory.tsx";
import styles from "./HouseholdChoreHistory.module.css";

type Props = {
  household: Household;
  userId: string;
  onBack: () => void;
};

type View = "weekly" | "monthly";

const VIEWS = [
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
] as const;

type ListState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; chores: Chore[] };

export default function HouseholdChoreHistory({ household, userId, onBack }: Props) {
  const today = localToday();
  const [view, setView] = useState<View>("weekly");
  const [weekStart, setWeekStart] = useState(startOfWeek(today));
  // The monthly view's month (SCRUM-47), kept here so it's still selected after opening a chore.
  const [month, setMonth] = useState(startOfMonth(today));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [selectedChoreId, setSelectedChoreId] = useState<string | null>(null);

  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  useEffect(() => {
    // The monthly view loads its own chores.
    if (view !== "weekly") return;

    let cancelled = false;

    setList({ status: "loading" });

    listChores(weekStart).then((result) => {
      if (cancelled) return;
      setList(result.ok ? { status: "ready", chores: result.chores } : { status: "failed" });
    });

    return () => {
      cancelled = true;
    };
  }, [view, weekStart, attempt]);

  function changeWeek(amount: number) {
    setWeekStart((current) => addDays(current, amount * 7));
    setSelectedDay(null);
  }

  if (selectedChoreId) {
    return (
      <SingleChoreHistory
        choreId={selectedChoreId}
        onBack={() => setSelectedChoreId(null)}
      />
    );
  }

  // The same header and Weekly / Monthly switch on both views.
  const top = (
    <>
      <header className={styles.header}>
        <TextLink className={styles.back} onClick={onBack}>
          Back
        </TextLink>
        <p className={styles.overline}>{household.name}</p>
        <h1 className={styles.title}>Household chore history</h1>
      </header>
      <TabFilter label="History view" options={VIEWS} selected={view} onSelect={setView} />
    </>
  );

  if (view === "monthly") {
    return (
      <main className={styles.page}>
        {top}
        <MonthlyChoreHistory
          userId={userId}
          month={month}
          onMonthChange={setMonth}
          onOpenChore={setSelectedChoreId}
        />
      </main>
    );
  }

  const weekChores =
    list.status === "ready"
      ? list.chores.filter((chore) => {
          const completedDate = chore.completedAt ? localDateOf(chore.completedAt) : null;
          return (
            (chore.dueDate >= weekStart && chore.dueDate <= weekEnd) ||
            (completedDate !== null && completedDate >= weekStart && completedDate <= weekEnd)
          );
        })
      : [];

  const shownChores = selectedDay
    ? weekChores.filter((chore) => {
        const completedDate = chore.completedAt ? localDateOf(chore.completedAt) : null;
        return chore.dueDate === selectedDay || completedDate === selectedDay;
      })
    : weekChores;

  const completedCount = weekChores.filter((chore) => {
    if (!chore.completedAt) return false;
    const completedDate = localDateOf(chore.completedAt);
    return completedDate >= weekStart && completedDate <= weekEnd;
  }).length;

  const incompleteCount = weekChores.filter(
    (chore) =>
      chore.dueDate >= weekStart &&
      chore.dueDate <= weekEnd &&
      chore.completedAt === null,
  ).length;

  const overdueCount = weekChores.filter(
    (chore) =>
      chore.dueDate >= weekStart &&
      chore.dueDate <= weekEnd &&
      chore.completedAt === null &&
      chore.dueDate < today,
  ).length;

  return (
    <main className={styles.page}>
      {top}

      <section className={styles.week}>
        <div className={styles.weekNavigation}>
          <Button variant="outline" onClick={() => changeWeek(-1)}>
            Previous
          </Button>
          <div className={styles.weekLabel}>
            <strong>
              {formatDate(weekStart, today)} – {formatDate(weekEnd, today)}
            </strong>
            {weekStart === startOfWeek(today) && <span>Current week</span>}
          </div>
          <Button variant="outline" onClick={() => changeWeek(1)}>
            Next
          </Button>
        </div>
        <Button
          variant="outline"
          fullWidth
          onClick={() => {
            setWeekStart(startOfWeek(today));
            setSelectedDay(null);
          }}
        >
          Go to current week
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
          <Button
            variant="outline"
            onClick={() => {
              setList({ status: "loading" });
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {list.status === "ready" && (
        <>
          <section className={styles.summary} aria-label="Weekly chore summary">
            <div>
              <strong>{completedCount}</strong>
              <span>Completed</span>
            </div>
            <div>
              <strong>{incompleteCount}</strong>
              <span>Incomplete</span>
            </div>
            <div>
              <strong>{overdueCount}</strong>
              <span>Overdue</span>
            </div>
          </section>

          <section className={styles.days}>
            <h2>Select a day</h2>
            <div className={styles.dayButtons}>
              <button
                type="button"
                className={!selectedDay ? styles.selectedDay : styles.dayButton}
                aria-pressed={!selectedDay}
                onClick={() => setSelectedDay(null)}
              >
                All week
              </button>
              {days.map((day) => (
                <button
                  key={day}
                  type="button"
                  className={selectedDay === day ? styles.selectedDay : styles.dayButton}
                  aria-pressed={selectedDay === day}
                  onClick={() => setSelectedDay(day)}
                >
                  {formatDate(day, today)}
                </button>
              ))}
            </div>
          </section>

          <section className={styles.chores}>
            <h2>{selectedDay ? formatDate(selectedDay, today) : "Chores this week"}</h2>

            {shownChores.length === 0 ? (
              <p className={styles.message}>
                {weekChores.length === 0
                  ? "No chores found for this week."
                  : "No chores found for this day."}
              </p>
            ) : (
              <ul className={styles.list}>
                {shownChores.map((chore) => (
                  <li key={chore.id}>
                    <ChoreCard
                      name={chore.name}
                      details={choreDetails(chore, userId, today)}
                      status={choreStatus(chore, today)}
                      onViewHistory={() => setSelectedChoreId(chore.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
