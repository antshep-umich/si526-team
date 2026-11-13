import { useEffect, useState } from "react";
import { listChores } from "../api/chores.ts";
import type { Household } from "../api/households.ts";
import TabFilter from "../components/TabFilter.tsx";
import { choreStatus, type Chore } from "../chores.ts";
import { addDays, formatDate, localDateOf, startOfMonth, startOfWeek, today as localToday } from "../dates.ts";
import { assigneeLabel, doneTally, outcomeLine, weekRange } from "../history.ts";
import {
  HistoryGroup,
  HistoryHeader,
  HistoryMessage,
  HistoryPage,
  HistoryRow,
  HistorySection,
  PeriodNav,
  SummaryStrip,
} from "./HistoryParts.tsx";
import MonthlyChoreHistory from "./MonthlyChoreHistory.tsx";
import SingleChoreHistory from "./SingleChoreHistory.tsx";
import styles from "./HouseholdChoreHistory.module.css";

// Household chore history (Jira SCRUM-46 weekly, SCRUM-47 monthly), opened from the Home
// menu. Not in Figma yet: built from the histories' shared parts (HistoryParts.tsx).

type Props = {
  household: Household;
  userId: string;
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

/** A chore belongs to a day if it's due or was done that day. */
const onDay = (chore: Chore, day: string) =>
  chore.dueDate === day || (chore.completedAt !== null && localDateOf(chore.completedAt) === day);

export default function HouseholdChoreHistory({ household, userId }: Props) {
  const today = localToday();
  const [view, setView] = useState<View>("weekly");
  const [weekStart, setWeekStart] = useState(startOfWeek(today));
  // The monthly view's month (SCRUM-47), kept here so it survives switching to Weekly and back.
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

  function showWeek(start: string) {
    setWeekStart(start);
    setSelectedDay(null);
  }

  if (selectedChoreId) {
    return <SingleChoreHistory choreId={selectedChoreId} userId={userId} />;
  }

  // The same header and Weekly / Monthly switch on both views.
  const top = (
    <>
      <HistoryHeader overline={household.name} title="Household chore history" />
      <TabFilter label="History view" options={VIEWS} selected={view} onSelect={setView} />
    </>
  );

  if (view === "monthly") {
    return (
      <HistoryPage>
        {top}
        <MonthlyChoreHistory
          userId={userId}
          month={month}
          onMonthChange={setMonth}
          onOpenChore={setSelectedChoreId}
        />
      </HistoryPage>
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

  const shownChores = selectedDay ? weekChores.filter((chore) => onDay(chore, selectedDay)) : weekChores;

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

  const listTitle = selectedDay ? formatDate(selectedDay, today) : "Chores this week";

  return (
    <HistoryPage>
      {top}

      <PeriodNav
        unit="week"
        label={weekRange(weekStart)}
        isCurrent={weekStart === startOfWeek(today)}
        onPrevious={() => showWeek(addDays(weekStart, -7))}
        onNext={() => showWeek(addDays(weekStart, 7))}
        onCurrent={() => showWeek(startOfWeek(today))}
      />

      {list.status === "loading" && <HistoryMessage role="status">Loading household chore history…</HistoryMessage>}

      {list.status === "failed" && (
        <HistoryMessage
          onRetry={() => {
            setList({ status: "loading" });
            setAttempt((value) => value + 1);
          }}
        >
          Couldn't load household chore history.
        </HistoryMessage>
      )}

      {list.status === "ready" && (
        <>
          <SummaryStrip
            label="Weekly chore summary"
            items={[
              { label: "Completed", value: completedCount },
              { label: "Incomplete", value: incompleteCount },
              { label: "Overdue", value: overdueCount, tone: "overdue" },
            ]}
          />

          {/* Like the Weekly / Monthly switch: a track with the chosen day raised. */}
          <div className={styles.days} role="group" aria-label="Select a day">
            <button
              type="button"
              className={styles.day}
              aria-pressed={!selectedDay}
              onClick={() => setSelectedDay(null)}
            >
              <span className={styles.allWeek}>All</span>
            </button>
            {days.map((day) => (
              <button
                key={day}
                type="button"
                className={styles.day}
                aria-pressed={selectedDay === day}
                aria-label={formatDate(day, today)}
                data-today={day === today || undefined}
                onClick={() => setSelectedDay(day)}
              >
                <span className={styles.dayName}>
                  {new Date(`${day}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" })}
                </span>
                <span className={styles.dayNumber}>{Number(day.slice(8))}</span>
                <span className={styles.dot} data-has-chores={weekChores.some((chore) => onDay(chore, day)) || undefined} />
              </button>
            ))}
          </div>

          {shownChores.length === 0 ? (
            <HistorySection title={listTitle}>
              <HistoryMessage>
                {weekChores.length === 0 ? "No chores found for this week." : "No chores found for this day."}
              </HistoryMessage>
            </HistorySection>
          ) : (
            <HistoryGroup title={listTitle} aside={doneTally(shownChores)}>
              {shownChores.map((chore) => (
                <HistoryRow
                  key={chore.id}
                  name={chore.name}
                  status={choreStatus(chore, today)}
                  lines={[outcomeLine(chore, today), assigneeLabel(chore, userId)]}
                  viewLabel={`View history for ${chore.name}`}
                  onClick={() => setSelectedChoreId(chore.id)}
                />
              ))}
            </HistoryGroup>
          )}
        </>
      )}
    </HistoryPage>
  );
}
