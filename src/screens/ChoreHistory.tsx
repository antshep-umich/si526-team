import { useEffect, useId, useState } from "react";
import { getChore, listChoreHistory } from "../api/chores.ts";
import type { Household } from "../api/households.ts";
import PickerField from "../components/PickerField.tsx";
import TabFilter from "../components/TabFilter.tsx";
import { choreStatus, type Chore } from "../chores.ts";
import { formatDate, localDateOf, today as localToday } from "../dates.ts";
import {
  doneTally,
  filterHistory,
  groupHistory,
  historyDates,
  HISTORY_FILTERS,
  HISTORY_SORTS,
  isHistorySort,
  outcomeLine,
  sortHistory,
  statusLabel,
  type HistoryFilter,
  type HistorySort,
} from "../history.ts";
import styles from "./ChoreHistory.module.css";
import {
  DetailList,
  HistoryGroup,
  HistoryGroups,
  HistoryHeader,
  HistoryMessage,
  HistoryPage,
  HistoryRow,
  RowPanel,
} from "./HistoryParts.tsx";

// The person's own chore history (Jira SCRUM-44 View user chore history), opened from
// the Home menu. Not in Figma yet: built from the design system's components and the
// histories' shared parts (HistoryParts.tsx) until UX designs it.

type ChoreHistoryProps = {
  household: Household;
  userId: string;
};

type ListState = { status: "loading" } | { status: "failed" } | { status: "ready"; chores: Chore[] };

export default function ChoreHistory({ household, userId }: ChoreHistoryProps) {
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
    if (list.status === "loading") return <HistoryMessage role="status">Loading chore history…</HistoryMessage>;
    if (list.status === "failed") {
      return (
        <HistoryMessage
          onRetry={() => {
            setList({ status: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          Couldn't load your chore history.
        </HistoryMessage>
      );
    }
    if (list.chores.length === 0) return <HistoryMessage>No chore history.</HistoryMessage>;

    const shown = sortHistory(filterHistory(list.chores, filter), sort);
    return (
      <>
        <div className={styles.controls}>
          <TabFilter label="Show chores" options={HISTORY_FILTERS} selected={filter} onSelect={setFilter} />
          <PickerField
            label="Sort by"
            placeholder="Sort by"
            options={HISTORY_SORTS}
            value={sort}
            onChange={(value) => isHistorySort(value) && setSort(value)}
          />
        </div>
        {shown.length === 0 ? (
          <HistoryMessage>No chores match this filter.</HistoryMessage>
        ) : (
          // Grouped by the month of the date the list is sorted by.
          <HistoryGroups label="Chore history">
            {groupHistory(shown, sort).map((group) => (
              <HistoryGroup key={group.label} title={group.label} aside={doneTally(group.chores)}>
                {group.chores.map((chore) => {
                  const detailsId = `${idPrefix}-${chore.id}`;
                  const open = openId === chore.id;
                  return (
                    <HistoryRow
                      key={chore.id}
                      name={chore.name}
                      status={choreStatus(chore, today)}
                      lines={[outcomeLine(chore, today), historyDates(chore, today).created]}
                      onClick={() => setOpenId(open ? null : chore.id)}
                      expanded={open}
                      controls={detailsId}
                    >
                      {open && <ChoreDetails id={detailsId} choreId={chore.id} userId={userId} today={today} />}
                    </HistoryRow>
                  );
                })}
              </HistoryGroup>
            ))}
          </HistoryGroups>
        )}
      </>
    );
  }

  return (
    <HistoryPage>
      <HistoryHeader overline={household.name} title="My chore history" />
      {body()}
    </HistoryPage>
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
    if (state.status === "loading") return <HistoryMessage role="status">Loading details…</HistoryMessage>;
    if (state.status === "gone") return <HistoryMessage role="alert">Chore no longer available.</HistoryMessage>;
    if (state.status === "failed") {
      return (
        <HistoryMessage
          onRetry={() => {
            setState({ status: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          Couldn't load this chore.
        </HistoryMessage>
      );
    }

    const { chore } = state;
    return (
      <DetailList
        rows={[
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
        ]}
      />
    );
  }

  return <RowPanel id={id}>{content()}</RowPanel>;
}
