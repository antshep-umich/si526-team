import type { FormEvent, ReactNode } from "react";
import ThemedIcon from "../components/ThemedIcon.tsx";
import styles from "./Screen.module.css";

type ScreenProps = {
  title: string;
  children: ReactNode;
  /** Makes the screen a form, so the keyboard's Go / Enter key submits it. */
  onSubmit?: () => void;
  /** 24px between items instead of 40px. */
  tight?: boolean;
};

/** A full screen with a title, laid out like the Figma Sprint 2 frames. */
export default function Screen({ title, children, onSubmit, tight = false }: ScreenProps) {
  const className = `${styles.stack} ${tight ? styles.tight : ""}`;
  const content = (
    <>
      <h1 className={styles.title}>{title}</h1>
      {children}
    </>
  );
  return (
    <main className={styles.page}>
      {onSubmit ? (
        <form
          className={className}
          noValidate
          onSubmit={(e: FormEvent) => {
            e.preventDefault(); // stop the browser reloading the page
            onSubmit();
          }}
        >
          {content}
        </form>
      ) : (
        <div className={className}>{content}</div>
      )}
    </main>
  );
}

/** The main button and the link or second button under it. */
export function Actions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

/** Muted paragraph under a title. */
export function Intro({ children }: { children: ReactNode }) {
  return <p className={styles.intro}>{children}</p>;
}

/** An error that doesn't belong to one field. Renders nothing when there is none. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null; // an empty row would still add the 18px gap
  return (
    <p className={styles.formError} role="alert">
      <ThemedIcon name="alert" />
      {message}
    </p>
  );
}

export function Loading() {
  return (
    <main className={styles.page}>
      <p className={styles.loading} role="status">
        Loading…
      </p>
    </main>
  );
}
