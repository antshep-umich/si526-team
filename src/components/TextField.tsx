import { useId, type InputHTMLAttributes } from "react";
import styles from "./TextField.module.css";
import ThemedIcon from "./ThemedIcon.tsx";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  /** A blocking error, shown under the field. Leave empty when there's none. */
  error?: string | null;
};

export default function TextField({ label, error, className, ...inputProps }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className={styles.error}>
          <ThemedIcon name="alert" />
          {error}
        </p>
      )}
    </div>
  );
}
