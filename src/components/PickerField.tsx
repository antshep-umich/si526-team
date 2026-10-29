import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import fieldStyles from "./TextField.module.css";
import styles from "./PickerField.module.css";
import ThemedIcon from "./ThemedIcon.tsx";

export type PickerOption = { value: string; label: string };

type PickerFieldProps = {
  label: string;
  /** Shown until something is picked, for example "Select a housemate". */
  placeholder: string;
  options: readonly PickerOption[];
  /** The picked option's value, or null for none. */
  value: string | null;
  onChange: (value: string) => void;
  /** A blocking error, shown under the field. Leave empty when there's none. */
  error?: string | null;
  /** Help shown under the field. */
  hint?: ReactNode;
};

/**
 * Figma: Components / Picker field. "Default" is closed; the variant named Variant2 is
 * open, with the options listed under the field. Built as a select-only combobox
 * (WAI-ARIA pattern): focus stays on the field and arrow keys move through the options.
 */
export default function PickerField({ label, placeholder, options, value, onChange, error, hint }: PickerFieldProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const listId = `${id}-list`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // The keyboard highlight only shows once the arrow keys are used.
  const [keyboard, setKeyboard] = useState(false);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex];

  function show(viaKeyboard: boolean) {
    setActive(Math.max(0, selectedIndex));
    setKeyboard(viaKeyboard);
    setOpen(true);
  }

  function pick(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        show(true);
      }
      return;
    }
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key]!);
      setKeyboard(true);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pick(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={fieldStyles.field}>
      <span id={labelId} className={fieldStyles.label}>
        {label}
      </span>
      <div className={`${styles.picker} ${open ? styles.open : ""}`}>
        <div
          role="combobox"
          tabIndex={0}
          className={styles.trigger}
          aria-labelledby={labelId}
          aria-controls={listId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-activedescendant={open && options.length > 0 ? optionId(active) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onClick={() => (open ? setOpen(false) : show(false))}
          onKeyDown={onKeyDown}
          onBlur={() => setOpen(false)}
        >
          <span className={selected ? undefined : styles.placeholder}>{selected?.label ?? placeholder}</span>
          <ThemedIcon name={open ? "chevronUp" : "chevronDown"} className={open ? styles.up : undefined} />
        </div>
        <ul id={listId} role="listbox" aria-labelledby={labelId} className={styles.list} hidden={!open}>
          {options.map((option, index) => (
            <li
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={option.value === value}
              className={`${styles.option} ${keyboard && index === active ? styles.active : ""}`}
              // Keep focus on the combobox, so choosing doesn't close the list by blurring it first.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(index)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      </div>
      {error && (
        <p id={errorId} className={fieldStyles.error}>
          <ThemedIcon name="alert" />
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}
