import styles from "./NoteCard.module.css";

/** A note from a housemate. Curly quotes are added around the text. */
export default function NoteCard({ from, note }: { from: string; note: string }) {
  return (
    <figure className={styles.card}>
      <figcaption className={styles.from}>Note from {from}</figcaption>
      <blockquote className={styles.note}>
        “{note}”
      </blockquote>
    </figure>
  );
}
