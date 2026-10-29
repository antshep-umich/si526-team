import styles from "./ProgressCard.module.css";

type ProgressCardProps = {
  done: number;
  total: number;
  /** How many of the done chores were finished after their due date. */
  late?: number;
};

const percentOf = (part: number, total: number) =>
  total > 0 ? Math.min(100, Math.max(0, (part / total) * 100)) : 0;

/**
 * Figma: Components / Progress card, in four states: Empty ("No Chores Yet"),
 * Complete ("Complete!"), Late ("1 Late", with a yellow segment for the late
 * chores) and On track.
 */
export default function ProgressCard({ done, total, late = 0 }: ProgressCardProps) {
  const empty = total <= 0;
  const summary = empty ? "No Chores Yet" : `${done} of ${total} chores done`;
  const status = empty
    ? null
    : done >= total
      ? { text: "Complete!", className: styles.status }
      : late > 0
        ? { text: `${late} Late`, className: `${styles.status} ${styles.lateStatus}` }
        : { text: "On track", className: styles.status };

  return (
    <div className={styles.card}>
      <div className={styles.summary}>
        <p className={styles.count}>{summary}</p>
        {status && <p className={status.className}>{status.text}</p>}
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={summary}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        {!empty && <div className={styles.fill} style={{ width: `${percentOf(done, total)}%` }} />}
        {!empty && late > 0 && (
          <div className={styles.lateFill} style={{ width: `${percentOf(late, total)}%` }} />
        )}
      </div>
    </div>
  );
}
