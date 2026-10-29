import { useId, useState, type InputHTMLAttributes } from "react";
import styles from "./TextField.module.css";
import ThemedIcon from "./ThemedIcon.tsx";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  /** A blocking error, shown under the field. Leave empty when there's none. */
  error?: string | null;
};

/** Figma: Components / Text field. A password field gets the Input Box's show/hide eye. */
export default function TextField({ label, error, className, type, ...inputProps }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const [revealed, setRevealed] = useState(false);
  const password = type === "password";

  const input = (
    <input
      id={id}
      className={styles.input}
      type={password && revealed ? "text" : type}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      {...inputProps}
    />
  );

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {password ? (
        <div className={styles.control}>
          {input}
          <button
            type="button"
            className={styles.reveal}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            onClick={() => setRevealed(!revealed)}
          >
            <ThemedIcon name={revealed ? "eyeOpen" : "eyeOff"} />
          </button>
        </div>
      ) : (
        input
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          <ThemedIcon name="alert" />
          {error}
        </p>
      )}
    </div>
  );
}
