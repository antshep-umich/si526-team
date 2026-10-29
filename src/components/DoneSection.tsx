import styles from "./DoneSection.module.css";
import ThemedIcon from "./ThemedIcon.tsx";

type DoneSectionProps = {
  count: number;
  expanded: boolean;
  onToggle: () => void;
  /** The id of the list this opens and closes. */
  controls: string;
};

/**
 * Figma: Components / Done section (collapsed). "Default" is closed (chevron down);
 * the variant named Variant2 is open (chevron up). The done list itself follows it
 * on the screen.
 */
export default function DoneSection({ count, expanded, onToggle, controls }: DoneSectionProps) {
  return (
    <button
      type="button"
      className={styles.section}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
    >
      Done ({count})
      <ThemedIcon name={expanded ? "chevronUp" : "chevronDown"} className={expanded ? styles.up : undefined} />
    </button>
  );
}
