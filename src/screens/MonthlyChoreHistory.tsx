import { useEffect, useState } from "react";
import { listChores } from "../api/chores.ts";
import { choreStatus, type Chore } from "../chores.ts";
import { addMonths, formatMonth, startOfMonth, today as localToday } from "../dates.ts";
import { assigneeLabel, doneTally, outcomeLine } from "../history.ts";
import { choresDueInMonth, monthSummary } from "../monthlyHistory.ts";
import { HistoryGroup, HistoryMessage, HistoryRow, PeriodNav, SummaryStrip } from "./HistoryParts.tsx";

// The monthly view of Household chore history (Jira SCRUM-47). Not in Figma yet: it
// uses the histories' shared parts (HistoryParts.tsx), laid out like the weekly view
// (SCRUM-46) so the two views read as one screen.

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
      <PeriodNav
        unit="month"
        label={formatMonth(month)}
        isCurrent={month === currentMonth}
        onPrevious={() => onMonthChange(addMonths(month, -1))}
        onNext={() => onMonthChange(addMonths(month, 1))}
        onCurrent={() => onMonthChange(currentMonth)}
      />

      {list.status === "loading" && <HistoryMessage role="status">Loading household chore history…</HistoryMessage>}

      {list.status === "failed" && (
        <HistoryMessage onRetry={() => setAttempt((value) => value + 1)}>
          Couldn't load household chore history.
        </HistoryMessage>
      )}

      {list.status === "ready" &&
        (chores.length === 0 ? (
          <HistoryMessage>No chores this month.</HistoryMessage>
        ) : (
          <>
            <SummaryStrip
              label="Monthly chore summary"
              items={[
                { label: "Completed", value: summary.completed },
                { label: "Incomplete", value: summary.incomplete },
                { label: "Overdue", value: summary.overdue, tone: "overdue" },
              ]}
            />
            <HistoryGroup title="Chores this month" aside={doneTally(chores)}>
              {chores.map((chore) => (
                <HistoryRow
                  key={chore.id}
                  name={chore.name}
                  status={choreStatus(chore, today)}
                  lines={[outcomeLine(chore, today), assigneeLabel(chore, userId)]}
                  viewLabel={`View history for ${chore.name}`}
                  onClick={() => onOpenChore(chore.id)}
                />
              ))}
            </HistoryGroup>
          </>
        ))}
    </>
  );
}
