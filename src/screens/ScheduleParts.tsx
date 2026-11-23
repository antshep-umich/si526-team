import ThemedIcon from "../components/ThemedIcon.tsx";
import { dayHeading, weekdayShort, type DaySummary } from "../schedule.ts";
import styles from "./Schedule.module.css";

// The Schedule's parts Figma doesn't have yet (placeholders, README Conflicts row 55): the
// previous / next bar with "Today", the week strip and the month calendar. Built only from
// the design system's tokens until UX designs them.

/** The date range between previous and next arrows (AC1, AC4), and "Today" (AC5). */
export function ScheduleNav({
  unit,
  label,
  onPrevious,
  onNext,
  onToday,
}: {
  unit: "week" | "month";
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className={styles.navRow}>
      <section className={styles.nav} aria-label={unit === "week" ? "Week" : "Month"}>
        <button type="button" className={styles.step} aria-label={`Previous ${unit}`} onClick={onPrevious}>
          <ThemedIcon name="chevronDown" className={styles.pointBack} />
        </button>
        <h2 className={styles.range} aria-live="polite">
          {label}
        </h2>
        <button type="button" className={styles.step} aria-label={`Next ${unit}`} onClick={onNext}>
          <ThemedIcon name="chevronDown" className={styles.pointForward} />
        </button>
      </section>
      <button type="button" className={styles.today} onClick={onToday}>
        Today
      </button>
    </div>
  );
}

type DaysProps = {
  days: string[];
  summary: Map<string, DaySummary>;
  selected: string;
  today: string;
  onSelect: (day: string) => void;
};

/** "Thursday, Nov 19: 3 chores, one overdue" */
function dayName(day: string, today: string, { count, overdue }: DaySummary): string {
  const chores = count === 0 ? "no chores" : count === 1 ? "1 chore" : `${count} chores`;
  return `${dayHeading(day, today)}${day === today ? " (today)" : ""}: ${chores}${overdue ? ", overdue" : ""}`;
}

function Day({ day, summary, selected, today, onSelect, weekday }: Omit<DaysProps, "days" | "summary"> & { day: string; summary: DaySummary; weekday: boolean }) {
  const classes = [styles.day, day === today && styles.isToday, day === selected && styles.isSelected]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={classes}
      aria-pressed={day === selected}
      aria-current={day === today ? "date" : undefined}
      aria-label={dayName(day, today, summary)}
      onClick={() => onSelect(day)}
    >
      {weekday && <span className={styles.weekday}>{weekdayShort(day).slice(0, 1)}</span>}
      <span className={styles.date}>{Number(day.slice(8))}</span>
      <span className={styles.count}>
        {summary.count > 0 ? summary.count : ""}
        {summary.overdue && <span className={styles.overdueDot} />}
      </span>
    </button>
  );
}

/** AC2: seven days, Monday to Sunday, each with its count and a mark for an overdue chore. */
export function WeekStrip({ days, summary, ...rest }: DaysProps) {
  return (
    <ol className={styles.week} aria-label="Days of the week">
      {days.map((day) => (
        <li key={day}>
          <Day day={day} summary={summary.get(day)!} weekday {...rest} />
        </li>
      ))}
    </ol>
  );
}

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** The month as a calendar, Monday to Sunday, each day with its count and overdue mark. */
export function MonthGrid({ days, summary, ...rest }: DaysProps) {
  const blanks = (new Date(`${days[0]}T00:00:00`).getDay() + 6) % 7;
  return (
    <div className={styles.month}>
      <div className={styles.monthHead} aria-hidden="true">
        {WEEKDAY_LETTERS.map((letter, i) => (
          <span key={i}>{letter}</span>
        ))}
      </div>
      <ol className={styles.monthDays} aria-label="Days of the month">
        {Array.from({ length: blanks }, (_, i) => (
          <li key={`blank-${i}`} aria-hidden="true" />
        ))}
        {days.map((day) => (
          <li key={day}>
            <Day day={day} summary={summary.get(day)!} weekday={false} {...rest} />
          </li>
        ))}
      </ol>
    </div>
  );
}
