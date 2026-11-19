import { useId, useState } from "react";
import Chip from "./Chip.tsx";
import Collapse from "./Collapse.tsx";
import styles from "./ChoreCard.module.css";
import ThemedIcon from "./ThemedIcon.tsx";

/**
 * Figma: Components / Chore card. "late" is the variant named Status4: done, but after
 * the due date. A chore that's simply to do ("pending") has no chip.
 */
export type ChoreStatus = "pending" | "overdue" | "done" | "late";

/** What the card's dropdown shows (SCRUM-7 AC11, SCRUM-53). */
export type ChoreCardPanel = {
  /** Label and value pairs, for example ["Assigned To:", "You"]. */
  rows: [string, string][];
  /** Opens Edit chore. Only for people who may edit the chore (canEditChore). */
  onEdit?: () => void;
  /** Opens the chore's history (SCRUM-45). */
  onViewHistory?: () => void;
};

type ChoreCardProps = {
  name: string;
  /** Who and when, for example "You · due today" or "Jordan · done Fri, Oct 9". */
  details: string;
  status: ChoreStatus;
  /**
   * Called when the checkbox is pressed. Without it there's no checkbox, only the
   * space it would take (chores assigned to someone else).
   */
  onToggle?: () => void;
  /** Turns the checkbox off while a change is being saved. */
  busy?: boolean;
  /**
   * The chore's details, which drop down under the card from the chevron at its right
   * (Figma "Schedule", 837:1483). Without it the card has no chevron.
   */
  panel?: ChoreCardPanel;
};

const CHIPS = {
  overdue: <Chip tone="overdue">Overdue</Chip>,
  done: <Chip tone="success">Done</Chip>,
  late: <Chip tone="late">Late</Chip>,
  pending: null,
} as const;

export default function ChoreCard({ name, details, status, onToggle, busy = false, panel }: ChoreCardProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const done = status === "done" || status === "late";
  const toggle = () => setOpen((isOpen) => !isOpen);

  return (
    <div className={`${styles.card} ${status === "overdue" ? styles.overdue : ""} ${done ? styles.done : ""}`}>
      <div className={styles.row}>
        {onToggle ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={done ? `Mark ${name} not done` : `Mark ${name} done`}
            className={styles.checkbox}
            onClick={onToggle}
            disabled={busy}
          >
            {done ? (
              <span className={styles.checked}>
                <ThemedIcon name="check" />
              </span>
            ) : (
              <ThemedIcon name={status === "overdue" ? "checkboxOverdue" : "checkboxPending"} />
            )}
          </button>
        ) : (
          <span className={styles.checkbox} aria-hidden="true" />
        )}
        {panel ? (
          // The name and details open the dropdown too, as the one control screen readers
          // and the keyboard use. A button may only hold phrasing content, so spans stand in.
          <button
            type="button"
            className={`${styles.text} ${styles.open}`}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={toggle}
          >
            <span className={styles.name}>{name}</span>{" "}
            <span className={styles.details}>{details}</span>
          </button>
        ) : (
          <div className={styles.text}>
            <p className={styles.name}>{name}</p>
            <p className={styles.details}>{details}</p>
          </div>
        )}
        {CHIPS[status]}
        {panel && (
          // A bigger target for fingers; the name button above is the accessible one.
          <button type="button" className={styles.chevron} tabIndex={-1} aria-hidden="true" onClick={toggle}>
            <ThemedIcon name="chevronDown" className={open ? styles.up : undefined} />
          </button>
        )}
      </div>
      {panel && (
        <Collapse open={open} id={panelId}>
          <div className={styles.panel}>
            <dl className={styles.facts}>
              {panel.rows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {panel.onEdit && (
              <button type="button" className={styles.edit} aria-label={`Edit ${name}`} onClick={panel.onEdit}>
                <ThemedIcon name="pencil" />
              </button>
            )}
            {panel.onViewHistory && (
              <button
                type="button"
                className={styles.historyButton}
                onClick={panel.onViewHistory}
                aria-label={`View history for ${name}`}
              >
                View history
              </button>
            )}
          </div>
        </Collapse>
      )}
    </div>
  );
}
