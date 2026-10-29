import { useId, type TextareaHTMLAttributes } from "react";
import fieldStyles from "./TextField.module.css";
import styles from "./TextArea.module.css";
import ThemedIcon from "./ThemedIcon.tsx";

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  label: string;
  /** A blocking error, shown under the field. Leave empty when there's none. */
  error?: string | null;
};

/** Figma: Components / Text area (462:225). Multi-line, styled like Text field. */
export default function TextArea({ label, error, className, ...textareaProps }: TextAreaProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={[fieldStyles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={fieldStyles.label}>
        {label}
      </label>
      <textarea
        id={id}
        className={`${fieldStyles.input} ${styles.textarea}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...textareaProps}
      />
      {error && (
        <p id={errorId} className={fieldStyles.error}>
          <ThemedIcon name="alert" />
          {error}
        </p>
      )}
    </div>
  );
}
