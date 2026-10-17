import styles from "./ProgressCard.module.css";

type ProgressCardProps = {
  done: number;
  total: number;
  /** Short status on the right, for example "On track". */
  status?: string;
};

export default function ProgressCard({ done, total, status }: ProgressCardProps) {
  const percent = total > 0 ? Math.min(100, Math.max(0, (done / total) * 100)) : 0;
  const summary = `${done} of ${total} chores done`;
  return (
    <div className={styles.card}>
      <div className={styles.summary}>
        <p className={styles.count}>{summary}</p>
        {status && <p className={styles.status}>{status}</p>}
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={summary}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
