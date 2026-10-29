import Chip from "./Chip.tsx";
import styles from "./ChoreCard.module.css";
import ThemedIcon from "./ThemedIcon.tsx";

/**
 * Figma: Components / Chore card. "late" is the variant named Status4: done, but after
 * the due date. A chore that's simply to do ("pending") has no chip.
 */
export type ChoreStatus = "pending" | "overdue" | "done" | "late";

type ChoreCardProps = {
  name: string;
  /** Who and when, for example "You · due today" or "Jordan · done Oct 9 · due Oct 8". */
  details: string;
  status: ChoreStatus;
  /**
   * Called when the checkbox is pressed. Without it there's no checkbox, only the
   * space it would take (chores assigned to someone else).
   */
  onToggle?: () => void;
  /** Turns the checkbox off while a change is being saved. */
  busy?: boolean;
};

export default function ChoreCard({ name, details, status, onToggle, busy = false }: ChoreCardProps) {
  const done = status === "done" || status === "late";
  return (
    <div className={`${styles.card} ${status === "overdue" ? styles.overdue : ""} ${done ? styles.done : ""}`}>
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
        // Not in Figma yet: only the assignee can tick a chore, so the others see a gap.
        <span className={styles.checkbox} aria-hidden="true" />
      )}
      <div className={styles.text}>
        <p className={styles.name}>{name}</p>
        <p className={styles.details}>{details}</p>
      </div>
      {status === "overdue" && <Chip tone="overdue">Overdue</Chip>}
      {status === "done" && <Chip tone="success">Done</Chip>}
      {status === "late" && <Chip tone="late">Late</Chip>}
    </div>
  );
}
