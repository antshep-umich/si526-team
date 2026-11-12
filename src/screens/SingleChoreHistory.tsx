import { useEffect, useState } from "react";
import { getChoreHistory, type ChoreHistoryResult } from "../api/chores.ts";
import { formatDate, today as localToday } from "../dates.ts";
import { assigneeLabel, eventWhen, statusLabel } from "../history.ts";
import { DetailList, HistoryHeader, HistoryMessage, HistoryPage, HistorySection } from "./HistoryParts.tsx";
import styles from "./SingleChoreHistory.module.css";

// SCRUM-45 View Single Chore History for Household: one chore's details and everything
// that happened to it, newest first. Opened from a chore on Home or in Household chore
// history. Not in Figma yet: built from the histories' shared parts (HistoryParts.tsx).

type ChoreHistoryProps = {
  choreId: string;
  /** The signed-in user, who's shown as "You". */
  userId?: string;
  onBack: () => void;
};

type ChoreEvent = Extract<ChoreHistoryResult, { ok: true }>["history"][number];

const EVENT_LABELS: Record<string, string> = {
  created: "Created",
  completed: "Marked done",
  reopened: "Marked not done",
  due_date_changed: "Due date changed",
};

export default function SingleChoreHistory({ choreId, userId, onBack }: ChoreHistoryProps) {
  const [result, setResult] = useState<ChoreHistoryResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const today = localToday();

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    getChoreHistory(choreId).then((response) => {
      if (!cancelled) setResult(response);
    });
    return () => {
      cancelled = true;
    };
  }, [choreId, attempt]);

  const person = (who: { userId: string; name: string } | null) =>
    !who ? "Someone who left" : who.userId === userId ? "You" : who.name;

  if (!result || !result.ok) {
    return (
      <HistoryPage>
        <HistoryHeader backLabel="Back to chores" onBack={onBack} title="Chore history" />
        {!result ? (
          <HistoryMessage role="status">Loading chore history…</HistoryMessage>
        ) : result.code === "CHORE_NOT_FOUND" ? (
          <HistoryMessage role="alert">Chore no longer available.</HistoryMessage>
        ) : (
          <HistoryMessage onRetry={() => setAttempt((n) => n + 1)}>Couldn't load chore history.</HistoryMessage>
        )}
      </HistoryPage>
    );
  }

  const { chore, history } = result;
  const events = [...history].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <HistoryPage>
      <HistoryHeader backLabel="Back to chores" onBack={onBack} overline="Chore history" title={chore.name}>
        {chore.notes && <p className={styles.notes}>{chore.notes}</p>}
      </HistoryHeader>

      <HistorySection title="Chore details">
        <DetailList
          card
          rows={[
            ["Assigned to", userId ? assigneeLabel(chore, userId) : (chore.assignee?.name ?? "Unassigned")],
            ["Status", statusLabel(chore, today)],
            ["Due", formatDate(chore.dueDate, today)],
            ["Created", `${eventWhen(chore.createdAt, today)} by ${person(chore.createdBy)}`],
            [
              "Completed",
              chore.completedAt ? `${eventWhen(chore.completedAt, today)} by ${person(chore.completedBy)}` : "Not done yet",
            ],
          ]}
        />
      </HistorySection>

      <HistorySection title="Activity" aside={events.length > 0 ? "Newest first" : undefined}>
        {events.length === 0 ? (
          <HistoryMessage>No chore history.</HistoryMessage>
        ) : (
          <Timeline events={events} today={today} person={person} />
        )}
      </HistorySection>
    </HistoryPage>
  );
}

/** What happened to the chore, newest first, joined by a line. */
function Timeline({
  events,
  today,
  person,
}: {
  events: ChoreEvent[];
  today: string;
  person: (who: { userId: string; name: string } | null) => string;
}) {
  return (
    <ol className={styles.timeline} aria-label="Chore activity">
      {events.map((event) => (
        <li key={event.id} className={styles.event} data-kind={event.eventType}>
          <span className={styles.mark} aria-hidden="true" />
          <span className={styles.eventTitle}>{EVENT_LABELS[event.eventType] ?? "Updated"}</span>
          <span className={styles.eventMeta}>
            {eventWhen(event.createdAt, today)} by {person(event.actor)}
          </span>
          {/* Every event records the due date at the time; only a change makes it new. */}
          {event.dueDate && (
            <span className={styles.eventMeta}>
              {event.eventType === "due_date_changed" ? "New due date" : "Due"} {formatDate(event.dueDate, today)}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
