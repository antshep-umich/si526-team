import { useState } from "react";
import type { Household } from "../api/households.ts";
import Button from "../components/Button.tsx";
import TabFilter from "../components/TabFilter.tsx";
import ThemedIcon from "../components/ThemedIcon.tsx";
import { CHORE_FILTERS, saveChoreFilter, savedChoreFilter, type ChoreFilter } from "../choreFilter.ts";
import { isMine, type Chore } from "../chores.ts";
import { today as localToday } from "../dates.ts";
import {
  SCHEDULE_MODES,
  choresOnDay,
  dayHeading,
  daysFrom,
  periodLabel,
  periodOf,
  stepSpot,
  summarizeDays,
  type ScheduleSpot,
} from "../schedule.ts";
import { useChoreList } from "../useChoreList.ts";
import ChoreItem from "./ChoreItem.tsx";
import Header from "./Header.tsx";
import styles from "./Schedule.module.css";
import { MonthGrid, ScheduleNav, WeekStrip } from "./ScheduleParts.tsx";

// SCRUM-73 Schedule Page: the household's chores by day (Figma "SCRUM-73 Schedule Page",
// 837:1483, for the header, the Week | Month and All | Mine switches, the day heading and
// the cards). The week strip, the range bar and the month calendar are placeholders
// (ScheduleParts.tsx). Design notes: docs/superpowers/specs/2026-11-23-schedule-design.md.

export const SCHEDULE_FAILED = "We couldn’t load the schedule. Please try again.";
export const NO_CHORES_ON_DAY = "No chores on this day.";

type ScheduleProps = {
  household: Household;
  userId: string;
  /** Where the Schedule is, kept by App so it's still there after Edit chore or a history. */
  spot: ScheduleSpot;
  onSpotChange: (spot: ScheduleSpot) => void;
  onEditChore: (chore: Chore) => void;
  onOpenChore: (choreId: string) => void;
};

export default function Schedule({ household, userId, spot, onSpotChange, onEditChore, onOpenChore }: ScheduleProps) {
  const today = localToday();
  const period = periodOf(spot);
  const { list, retry, toggle, saving, toggleError } = useChoreList(period.first);
  const [filter, setFilter] = useState<ChoreFilter>(savedChoreFilter);

  function changeFilter(next: ChoreFilter) {
    setFilter(next);
    saveChoreFilter(next);
  }

  function body() {
    if (list.status === "loading") {
      // Not in Figma yet (placeholder): the loading indicator.
      return (
        <p className={styles.message} role="status">
          Loading the schedule…
        </p>
      );
    }
    if (list.status === "failed") {
      // AC11, with the story's words. Not in Figma yet (placeholder): the layout.
      return (
        <div className={styles.failed}>
          <p className={styles.message} role="alert">
            {SCHEDULE_FAILED}
          </p>
          <Button variant="outline" onClick={retry}>
            Retry
          </Button>
        </div>
      );
    }

    const shown = filter === "mine" ? list.chores.filter((chore) => isMine(chore, userId)) : list.chores;
    const days = daysFrom(period.first, period.last);
    const summary = summarizeDays(shown, days, today);
    const onDay = choresOnDay(shown, spot.day, today);
    const select = (day: string) => onSpotChange({ ...spot, day });
    const Days = spot.mode === "week" ? WeekStrip : MonthGrid;

    return (
      <>
        <Days days={days} summary={summary} selected={spot.day} today={today} onSelect={select} />
        <section className={styles.dayChores} aria-labelledby="schedule-day">
          <h2 id="schedule-day" className={styles.dayHeading}>
            {dayHeading(spot.day, today)}
          </h2>
          {toggleError && (
            // Not in Figma yet (placeholder): the update error, as on the Chore List.
            <p className={styles.toggleError} role="alert">
              <ThemedIcon name="alert" />
              {toggleError}
            </p>
          )}
          {onDay.length === 0 ? (
            <p className={styles.message}>{NO_CHORES_ON_DAY}</p>
          ) : (
            <ul className={styles.list} aria-label="Chores on this day">
              {onDay.map((chore) => (
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
              ))}
            </ul>
          )}
        </section>
      </>
    );
  }

  return (
    <main className={styles.page}>
      <Header title="Schedule" />
      <TabFilter
        label="Schedule view"
        options={SCHEDULE_MODES}
        selected={spot.mode}
        onSelect={(mode) => onSpotChange({ ...spot, mode })}
      />
      <TabFilter label="Show chores" options={CHORE_FILTERS} selected={filter} onSelect={changeFilter} />
      <ScheduleNav
        unit={spot.mode}
        label={periodLabel(spot)}
        onPrevious={() => onSpotChange(stepSpot(spot, -1, today))}
        onNext={() => onSpotChange(stepSpot(spot, 1, today))}
        onToday={() => onSpotChange({ mode: spot.mode, day: today })}
      />
      {body()}
    </main>
  );
}
