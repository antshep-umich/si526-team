
import { useEffect, useState } from "react";
import { getChoreHistory, type ChoreHistoryResult } from "../api/chores.ts";
import Button from "../components/Button.tsx";
import styles from "./SingleChoreHistory.module.css";

// SCRUM-45 View Single Chore History for Household.

type ChoreHistoryProps = {
  choreId: string;
  onBack: () => void;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDueDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function eventLabel(eventType: string): string {
  switch (eventType) {
    case "created":
      return "Chore created";
    case "completed":
      return "Chore completed";
    case "reopened":
      return "Chore reopened";
    case "due_date_changed":
      return "Due date changed";
    default:
      return "Chore updated";
  }
}

export default function ChoreHistory({ choreId, onBack }: ChoreHistoryProps) {
  const [result, setResult] = useState<ChoreHistoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setResult(null);

    getChoreHistory(choreId).then((response) => {
      if (!cancelled) {
        setResult(response);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [choreId, attempt]);

  const retry = () => {
    setAttempt((previous) => previous + 1);
  };

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <Button type="button" variant="outline" onClick={onBack}>
          Back to chores
        </Button>

        {loading && <p className={styles.message}>Loading chore history…</p>}

        {!loading && result && !result.ok && (
          <div className={styles.error}>
            <p>
              {result.code === "CHORE_NOT_FOUND"
                ? "Chore no longer available."
                : "Couldn't load chore history. Please try again."}
            </p>
            <Button type="button" onClick={retry}>
              Retry
            </Button>
          </div>
        )}

        {!loading && result?.ok && (
          <>
            <header className={styles.header}>
              <p className={styles.overline}>Chore history</p>
              <h1>{result.chore.name}</h1>
              {result.chore.notes && <p>{result.chore.notes}</p>}
            </header>

            <section className={styles.details}>
              <h2>Chore details</h2>
              <p>
                <strong>Created:</strong> {formatDate(result.chore.createdAt)}
              </p>
              <p>
                <strong>Due date:</strong> {formatDueDate(result.chore.dueDate)}
              </p>
              <p>
                <strong>Assigned to:</strong>{" "}
                {result.chore.assignee?.name ?? "Housemate unavailable"}
              </p>
            </section>

            <section className={styles.history}>
              <h2>Activity history</h2>

              {result.history.length === 0 ? (
                <p className={styles.message}>No chore history.</p>
              ) : (
                <ol className={styles.list}>
                  {[...result.history]
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                    )
                    .map((event) => (
                      <li key={event.id} className={styles.event}>
                        <h3>{eventLabel(event.eventType)}</h3>
                        <p>{formatDate(event.createdAt)}</p>

                        <p>
                          <strong>Housemate:</strong>{" "}
                          {event.actor?.name ?? "Housemate unavailable"}
                        </p>

                        {event.dueDate && (
                          <p>
                            <strong>Due date:</strong>{" "}
                            {formatDueDate(event.dueDate)}
                          </p>
                        )}
                      </li>
                    ))}
                </ol>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
