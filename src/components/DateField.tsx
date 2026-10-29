import { useId, useRef } from "react";
import { formatDate, today } from "../dates.ts";
import styles from "./PickerField.module.css";
import fieldStyles from "./TextField.module.css";
import ThemedIcon from "./ThemedIcon.tsx";

type DateFieldProps = {
  label: string;
  /** Shown until a date is picked, for example "Pick a date". */
  placeholder: string;
  /** "YYYY-MM-DD", or "" for none. */
  value: string;
  onChange: (value: string) => void;
  /** The earliest date allowed, "YYYY-MM-DD". */
  min?: string;
  /** A blocking error, shown under the field. Leave empty when there's none. */
  error?: string | null;
};

/**
 * Figma: Components / Picker field with the calendar icon. Tapping it opens the phone's
 * own date picker (Figma has no calendar design, and the phone's is accessible).
 */
export default function DateField({ label, placeholder, value, onChange, min, error }: DateFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const input = useRef<HTMLInputElement>(null);

  function openPicker() {
    try {
      input.current?.showPicker?.();
    } catch {
      // Some browsers only allow it from certain gestures; the input still opens on tap.
    }
  }

  return (
    <div className={fieldStyles.field}>
      <label htmlFor={id} className={fieldStyles.label}>
        {label}
      </label>
      <div className={styles.dateControl}>
        <input
          ref={input}
          id={id}
          type="date"
          className={`${styles.trigger} ${styles.dateInput}`}
          value={value}
          min={min}
          onChange={(event) => onChange(event.target.value)}
          onClick={openPicker}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <span className={`${styles.dateText} ${value ? "" : styles.datePlaceholder}`} aria-hidden="true">
          {value ? formatDate(value, today()) : placeholder}
        </span>
        <ThemedIcon name="calendar" className={styles.dateIcon} />
      </div>
      {error && (
        <p id={errorId} className={fieldStyles.error}>
          <ThemedIcon name="alert" />
          {error}
        </p>
      )}
    </div>
  );
}
