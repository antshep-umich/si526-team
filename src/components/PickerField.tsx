import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import fieldStyles from "./TextField.module.css";
import styles from "./PickerField.module.css";
import Collapse from "./Collapse.tsx";
import ThemedIcon from "./ThemedIcon.tsx";

export type PickerOption = {
  value: string;
  /** What the option is, and what the field shows once it's picked. */
  label: string;
  /** A second, smaller line in the list only, for example "Prefers this chore · 2 open chores". */
  detail?: string;
  /**
   * A heading the option is listed under, for example "Suggested". Options with the same
   * group must be next to each other; without groups the list is flat.
   */
  group?: string;
};

/** Runs of options under the same heading, keeping each option's place in the whole list. */
function groupsOf(options: readonly PickerOption[]) {
  const groups: { name: string; items: { option: PickerOption; index: number }[] }[] = [];
  options.forEach((option, index) => {
    const name = option.group ?? "";
    const last = groups.at(-1);
    if (last && last.name === name) last.items.push({ option, index });
    else groups.push({ name, items: [{ option, index }] });
  });
  return groups;
}

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

/** The bottom of the area the list has to fit in: the screen, or the scrolling area holding the field. */
function roomBottom(element: HTMLElement): number {
  let bottom = window.innerHeight;
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) {
      bottom = Math.min(bottom, parent.getBoundingClientRect().bottom);
      break;
    }
  }
  return bottom;
}

/**
 * Figma: Components / Picker field. "Default" is closed; the variant named Variant2 is
 * open, with the options listed under the field. Built as a select-only combobox
 * (WAI-ARIA pattern): focus stays on the field and arrow keys move through the options.
 * The list opens over the page rather than pushing it down, and above the field when
 * there isn't room below (Anthony, 2026-11-19).
 */
export default function PickerField({ label, placeholder, options, value, onChange, error, hint }: PickerFieldProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const listId = `${id}-list`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const [open, setOpen] = useState(false);
  // The list opens above the field when it wouldn't fit below.
  const [above, setAbove] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  // The keyboard highlight only shows once the arrow keys are used.
  const [keyboard, setKeyboard] = useState(false);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex];

  function show(viaKeyboard: boolean) {
    const trigger = triggerRef.current;
    const list = listRef.current;
    if (trigger && list) {
      // The list is laid out even while closed, so its full height can be measured.
      const field = trigger.getBoundingClientRect();
      const below = roomBottom(trigger) - field.bottom;
      setAbove(list.scrollHeight > below && field.top > below);
    }
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
  const grouped = options.some((option) => option.group);

  const renderOption = (option: PickerOption, index: number) => (
    <li
      key={option.value}
      id={optionId(index)}
      role="option"
      aria-selected={option.value === value}
      // Both lines, read as one: "Ben Ito · Prefers this chore · 1 open chore".
      aria-label={option.detail ? `${option.label} · ${option.detail}` : undefined}
      className={`${styles.option} ${keyboard && index === active ? styles.active : ""}`}
      // Keep focus on the combobox, so choosing doesn't close the list by blurring it first.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => pick(index)}
    >
      {option.label}
      {option.detail && <span className={styles.detail}>{option.detail}</span>}
    </li>
  );

  return (
    <div className={fieldStyles.field}>
      <span id={labelId} className={fieldStyles.label}>
        {label}
      </span>
      <div className={`${styles.picker} ${open ? styles.open : ""} ${above ? styles.above : ""}`}>
        <div
          ref={triggerRef}
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
          <ThemedIcon name="chevronDown" className={`${styles.chevron} ${open ? styles.up : ""}`} />
        </div>
        <Collapse open={open} className={styles.popup}>
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={labelId}
            className={`${styles.list} ${grouped ? styles.grouped : ""}`}
          >
            {grouped
              ? // Not in Figma yet (SCRUM-64): a heading over each group of options.
                groupsOf(options).map((group, g) => (
                  <li key={group.name} role="presentation">
                    <span id={`${id}-group-${g}`} className={styles.groupLabel}>
                      {group.name}
                    </span>
                    <ul role="group" aria-labelledby={`${id}-group-${g}`} className={styles.list}>
                      {group.items.map(({ option, index }) => renderOption(option, index))}
                    </ul>
                  </li>
                ))
              : options.map((option, index) => renderOption(option, index))}
          </ul>
        </Collapse>
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
