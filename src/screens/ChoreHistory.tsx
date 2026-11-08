import { useEffect, useId, useState } from "react";
import { getChore, listChoreHistory } from "../api/chores.ts";
import type { Household } from "../api/households.ts";
import Button from "../components/Button.tsx";
import ChoreCard from "../components/ChoreCard.tsx";
import PickerField from "../components/PickerField.tsx";
import TabFilter from "../components/TabFilter.tsx";
import TextLink from "../components/TextLink.tsx";
import { choreStatus, type Chore } from "../chores.ts";
import { formatDate, localDateOf, today as localToday } from "../dates.ts";
import {
  filterHistory,
  historyDetails,
  HISTORY_FILTERS,
  HISTORY_SORTS,
  isHistorySort,
  sortHistory,
  statusLabel,
  type HistoryFilter,
  type HistorySort,
} from "../history.ts";
import styles from "./ChoreHistory.module.css";

// The person's own chore history (Jira SCRUM-44 View user chore history), opened from
// the Home menu. Not in Figma yet: the whole screen is a placeholder built from the
// design system's components until UX designs it.

type ChoreHistoryProps = {
  household: Household;
  userId: string;
  onBack: () => void;
};

type ListState = { status: "loading" } | { status: "failed" } | { status: "ready"; chores: Chore[] };

export default function ChoreHistory({ household, userId, onBack }: ChoreHistoryProps) {
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [sort, setSort] = useState<HistorySort>("due-newest");
  const [openId, setOpenId] = useState<string | null>(null);
  const idPrefix = useId();
  const today = localToday();

  useEffect(() => {
    let cancelled = false;
    listChoreHistory().then((result) => {
      if (cancelled) return;
      setList(result.ok ? { status: "ready", chores: result.chores } : { status: "failed" });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function body() {
    if (list.status === "loading") {
      return (
        <p className={styles.message} role="status">
          Loading chore history…
        </p>
      );
    }
    if (list.status === "failed") {
      return (
        <div className={styles.failed}>
          <p className={styles.message} role="alert">
            Couldn't load your chore history.
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
    if (list.chores.length === 0) return <p className={styles.message}>No chore history.</p>;

    const shown = sortHistory(filterHistory(list.chores, filter), sort);
    return (
      <>
        <TabFilter label="Show chores" options={HISTORY_FILTERS} selected={filter} onSelect={setFilter} />
        <PickerField
          label="Sort by"
          placeholder="Sort by"
          options={HISTORY_SORTS}
          value={sort}
          onChange={(value) => isHistorySort(value) && setSort(value)}
        />
        {shown.length === 0 ? (
          <p className={styles.message}>No chores match this filter.</p>
        ) : (
          <ul className={styles.list} aria-label="Chore history">
            {shown.map((chore) => {
              const detailsId = `${idPrefix}-${chore.id}`;
              const open = openId === chore.id;
              return (
                <li key={chore.id} className={styles.item}>
                  <ChoreCard
                    name={chore.name}
                    details={historyDetails(chore, today)}
                    status={choreStatus(chore, today)}
                    onOpen={() => setOpenId(open ? null : chore.id)}
                    expanded={open}
                    controls={detailsId}
                  />
                  {open && <ChoreDetails id={detailsId} choreId={chore.id} userId={userId} today={today} />}
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <TextLink className={styles.back} onClick={onBack}>
          Back
        </TextLink>
        <p className={styles.overline}>{household.name}</p>
        <h1 className={styles.title}>My chore history</h1>
      </div>
      {body()}
    </main>
  );
}

type DetailsState =
  | { status: "loading" }
  | { status: "gone" }
  | { status: "failed" }
  | { status: "ready"; chore: Chore };

/**
 * More about one chore, loaded fresh so a chore deleted since the list loaded shows
 * "Chore no longer available." (SCRUM-44). SCRUM-53 designs a full Chore details screen;
 * once that's built, opening a chore here can go there instead.
 */
function ChoreDetails({ id, choreId, userId, today }: { id: string; choreId: string; userId: string; today: string }) {
  const [state, setState] = useState<DetailsState>({ status: "loading" });
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

  function content() {
    if (state.status === "loading") {
      return (
        <p className={styles.message} role="status">
          Loading details…
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
    const rows: [string, string][] = [
      ["Status", statusLabel(chore, today)],
      ["Assigned to", person(chore.assignee)],
      ["Created", `${formatDate(localDateOf(chore.createdAt), today)} by ${person(chore.createdBy)}`],
      ["Due", formatDate(chore.dueDate, today)],
      [
        "Completed",
        chore.completedAt
          ? `${formatDate(localDateOf(chore.completedAt), today)} by ${person(chore.completedBy)}`
          : "Not done yet",
      ],
      ["Notes", chore.notes ?? "No description added."],
    ];
    return (
      <dl className={styles.details}>
        {rows.map(([term, value]) => (
          <div key={term} className={styles.row}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div id={id} className={styles.panel}>
      {content()}
    </div>
  );
}
