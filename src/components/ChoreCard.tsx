import Chip from "./Chip.tsx";
import styles from "./ChoreCard.module.css";
import ThemedIcon from "./ThemedIcon.tsx";

export type ChoreStatus = "pending" | "overdue" | "done";

type ChoreCardProps = {
  name: string;
  /** Who and when, for example "You · due today" or "Jordan · done 9:40 AM". */
  details: string;
  status: ChoreStatus;
  /** Called when the checkbox is pressed. Without it, the checkbox is display-only. */
  onToggle?: () => void;
};

export default function ChoreCard({ name, details, status, onToggle }: ChoreCardProps) {
  const done = status === "done";
  return (
    <div className={`${styles.card} ${status === "pending" ? "" : styles[status]}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Mark ${name} not done` : `Mark ${name} done`}
        className={styles.checkbox}
        onClick={onToggle}
        disabled={!onToggle}
      >
        {done ? (
          <span className={styles.checked}>
            <ThemedIcon name="check" />
          </span>
        ) : (
          <ThemedIcon name={status === "overdue" ? "checkboxOverdue" : "checkboxPending"} />
        )}
      </button>
      <div className={styles.text}>
        <p className={styles.name}>{name}</p>
        <p className={styles.details}>{details}</p>
      </div>
      {status === "overdue" && <Chip tone="overdue">Overdue</Chip>}
      {status === "done" && <Chip tone="success">Done</Chip>}
    </div>
  );
}
