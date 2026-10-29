import styles from "./OverdueBanner.module.css";
import ThemedIcon from "./ThemedIcon.tsx";

type OverdueBannerProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function OverdueBanner({ title, message, actionLabel = "Review", onAction }: OverdueBannerProps) {
  return (
    <div className={styles.banner} role="status">
      <ThemedIcon name="clock" />
      <div className={styles.text}>
        <p className={styles.title}>{title}</p>
        <p className={styles.message}>{message}</p>
      </div>
      {onAction && (
        <button type="button" className={styles.action} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
