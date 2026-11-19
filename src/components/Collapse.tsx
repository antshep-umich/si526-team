import { useEffect, useState, type ReactNode } from "react";
import styles from "./Collapse.module.css";

/** How long a roll-up takes; matches Collapse.module.css. */
export const COLLAPSE_MS = 220;

type CollapseProps = {
  open: boolean;
  children: ReactNode;
  /** For aria-controls on the button that opens it. */
  id?: string;
  /**
   * Mount the children only while open (and while rolling up), for content that loads
   * when it opens. By default they stay mounted, just hidden.
   */
  lazy?: boolean;
  className?: string;
};

/**
 * Rolls its content down and up (Anthony, 2026-11-19: every dropdown animates). Closed,
 * it's hidden from sight, screen readers and the Tab key. Not in Figma yet; reduced
 * motion turns the animation off.
 */
export default function Collapse({ open, children, id, lazy = false, className }: CollapseProps) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) return setMounted(true);
    const timer = setTimeout(() => setMounted(false), COLLAPSE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <div id={id} className={`${styles.collapse} ${open ? styles.open : ""} ${className ?? ""}`} inert={!open}>
      <div className={styles.inner}>{!lazy || open || mounted ? children : null}</div>
    </div>
  );
}
