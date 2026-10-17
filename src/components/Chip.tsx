import type { ReactNode } from "react";
import styles from "./Chip.module.css";

/** Figma: Components / Chip. "overdue" is Status=Overdue; "success" is Status=Done (also used for "Owner"). */
export type ChipTone = "overdue" | "success";

export default function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return <span className={`${styles.chip} ${styles[tone]}`}>{children}</span>;
}
