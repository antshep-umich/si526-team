import { useId, type ReactNode } from "react";
import Button from "../components/Button.tsx";
import Chip from "../components/Chip.tsx";
import type { ChoreStatus } from "../components/ChoreCard.tsx";
import TextLink from "../components/TextLink.tsx";
import ThemedIcon from "../components/ThemedIcon.tsx";
import styles from "./HistoryParts.module.css";

// The pieces the three chore histories share, so they read as one family while each
// keeps its own screen: My chore history (SCRUM-44), Household chore history (SCRUM-46
// and 47) and one chore's history (SCRUM-45). Not in Figma yet: built only from the
// design system's tokens and components until UX designs these screens.

export function HistoryPage({ children }: { children: ReactNode }) {
  return <main className={styles.page}>{children}</main>;
}

/** Back, then the overline and the screen's title, as on Figma "Home - Chore Details". */
export function HistoryHeader({
  backLabel = "Back",
  onBack,
  overline,
  title,
  children,
}: {
  backLabel?: string;
  onBack: () => void;
  overline?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <TextLink className={styles.back} onClick={onBack}>
        {backLabel}
      </TextLink>
      {overline && <p className={styles.overline}>{overline}</p>}
      <h1 className={styles.title}>{title}</h1>
      {children}
    </header>
  );
}

/** One bar to step through weeks or months, with a way back to the current one. */
export function PeriodNav({
  unit,
  label,
  isCurrent,
  onPrevious,
  onNext,
  onCurrent,
}: {
  unit: "week" | "month";
  label: string;
  isCurrent: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onCurrent: () => void;
}) {
  return (
    <section className={styles.period} aria-label={unit === "week" ? "Week" : "Month"}>
      <button type="button" className={styles.step} aria-label={`Previous ${unit}`} onClick={onPrevious}>
        <ThemedIcon name="chevronDown" className={styles.pointBack} />
      </button>
      <div className={styles.periodLabel}>
        <strong aria-live="polite">{label}</strong>
        {isCurrent ? (
          <span>Current {unit}</span>
        ) : (
          <TextLink className={styles.toCurrent} onClick={onCurrent}>
            Go to current {unit}
          </TextLink>
        )}
      </div>
      <button type="button" className={styles.step} aria-label={`Next ${unit}`} onClick={onNext}>
        <ThemedIcon name="chevronDown" className={styles.pointForward} />
      </button>
    </section>
  );
}

/** Completed / incomplete / overdue counts in one strip. Overdue only stands out when there are some. */
export function SummaryStrip({
  label,
  items,
}: {
  label: string;
  items: { label: string; value: number; tone?: "overdue" }[];
}) {
  return (
    <section className={styles.summary} aria-label={label}>
      {items.map((item) => (
        <div key={item.label} className={styles.stat} data-tone={item.value > 0 ? item.tone : undefined}>
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </div>
      ))}
    </section>
  );
}

/** A stack of groups, under one accessible name ("Chore history"). */
export function HistoryGroups({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className={styles.groups} aria-label={label}>
      {children}
    </section>
  );
}

/** A titled part of a history screen, with an optional note on the right ("2 of 3 done"). */
export function HistorySection({
  title,
  aside,
  titleId,
  children,
}: {
  title: string;
  aside?: string;
  titleId?: string;
  children: ReactNode;
}) {
  const ownId = useId();
  const id = titleId ?? ownId;
  return (
    <section className={styles.group} aria-labelledby={id}>
      <div className={styles.groupHead}>
        <h2 id={id} className={styles.groupTitle}>
          {title}
        </h2>
        {aside && <span className={styles.groupAside}>{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** A month, week or day: its heading, a count on the right, and its chores in one card. */
export function HistoryGroup({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <HistorySection title={title} aside={aside} titleId={titleId}>
      <ul className={styles.rows} aria-labelledby={titleId}>
        {children}
      </ul>
    </HistorySection>
  );
}

const CHIPS: Partial<Record<ChoreStatus, ReactNode>> = {
  overdue: <Chip tone="overdue">Overdue</Chip>,
  done: <Chip tone="success">Done</Chip>,
  late: <Chip tone="late">Late</Chip>,
};

/**
 * One chore in a history: its name and status chip, then its dates. Opens in place
 * (`expanded`, `controls`), or goes to the chore's own history (`viewLabel`).
 * No checkbox and no strikethrough: in a history, done is the usual state.
 */
export function HistoryRow({
  name,
  status,
  lines,
  onClick,
  expanded,
  controls,
  viewLabel,
  children,
}: {
  name: string;
  status: ChoreStatus;
  lines: string[];
  onClick: () => void;
  expanded?: boolean;
  controls?: string;
  /** The button's name when it goes to another screen, for example "View history for Mop kitchen". */
  viewLabel?: string;
  children?: ReactNode;
}) {
  const linesId = useId();
  const chevron = viewLabel ? styles.pointForward : expanded ? styles.pointUp : undefined;
  return (
    <li className={styles.row} data-status={status}>
      <button
        type="button"
        className={styles.rowButton}
        onClick={onClick}
        aria-expanded={viewLabel ? undefined : expanded}
        aria-controls={viewLabel ? undefined : controls}
        aria-label={viewLabel}
        aria-describedby={viewLabel ? linesId : undefined}
      >
        <span className={styles.rowName}>{name}</span>
        {CHIPS[status] && <span className={styles.rowChip}>{CHIPS[status]}</span>}
        <span id={linesId} className={styles.rowLines}>
          {lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </span>
        <ThemedIcon name="chevronDown" className={`${styles.rowChevron} ${chevron ?? ""}`} />
      </button>
      {children}
    </li>
  );
}

/** The panel a row opens in place. */
export function RowPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className={styles.panel}>
      {children}
    </div>
  );
}

/** Label and value pairs, in two columns: recessed inside a row's panel, or as a card of its own. */
export function DetailList({ rows, card = false }: { rows: [string, ReactNode][]; card?: boolean }) {
  return (
    <dl className={`${styles.details} ${card ? styles.detailsCard : ""}`}>
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A loading, empty or error message. With onRetry, it's an error with a Try again button. */
export function HistoryMessage({
  children,
  role,
  onRetry,
}: {
  children: ReactNode;
  role?: "status" | "alert";
  onRetry?: () => void;
}) {
  if (!onRetry) {
    return (
      <p className={styles.message} role={role}>
        {children}
      </p>
    );
  }
  return (
    <div className={styles.failed}>
      <p className={styles.message} role="alert">
        {children}
      </p>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
