import type { ButtonHTMLAttributes } from "react";
import styles from "./TextLink.module.css";

/** Looks like a link, acts as a button: it switches screens rather than loading a URL. */
export default function TextLink({ className, type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={[styles.link, className].filter(Boolean).join(" ")} {...rest} />;
}
