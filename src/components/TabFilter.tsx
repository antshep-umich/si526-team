import { useRef, type KeyboardEvent } from "react";
import styles from "./TabFilter.module.css";

type TabFilterProps<T extends string> = {
  /** Read out with the options, for example "Show chores". */
  label: string;
  options: readonly { id: T; label: string }[];
  selected: T;
  onSelect: (id: T) => void;
};

/**
 * Figma: Components / Tab Filter (Left Selected | Right Selected). A two-way switch
 * such as All / Mine. It's a radio group: arrow keys move between the options.
 */
export default function TabFilter<T extends string>({ label, options, selected, onSelect }: TabFilterProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onSelect(options[next]!.id);
    buttons.current[next]?.focus();
  }

  return (
    <div className={styles.filter} role="radiogroup" aria-label={label}>
      {options.map((option, index) => {
        const active = option.id === selected;
        return (
          <button
            key={option.id}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className={`${styles.segment} ${active ? styles.selected : ""}`}
            onClick={() => onSelect(option.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
