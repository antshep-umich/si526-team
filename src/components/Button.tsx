import type { ComponentProps } from "react";
import styles from "./Button.module.css";

// ComponentProps includes `ref` (React 19 passes it as a prop), for focusing a button.
type ButtonProps = ComponentProps<"button"> & {
  /** Primary for main actions, Outline for secondary (Figma component description). */
  variant?: "primary" | "outline";
  /** Stretch to the container's width, as on full-screen forms. */
  fullWidth?: boolean;
};

export default function Button({
  variant = "primary",
  fullWidth = false,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], fullWidth && styles.fullWidth, className]
    .filter(Boolean)
    .join(" ");
  return <button type={type} className={classes} {...rest} />;
}
