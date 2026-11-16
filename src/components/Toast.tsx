import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import styles from "./Toast.module.css";

// Not in Figma yet (placeholder): a short message that pops up above the tab bar and goes
// away by itself, for the stories' "Message: …" confirmations (README Conflicts row 9).

/** How long a toast stays before it starts to fade. */
export const TOAST_MS = 4000;
/** The fade out, kept in step with Toast.module.css. */
const FADE_MS = 200;

type ToastState = { id: number; message: string; leaving: boolean };

const ShowToast = createContext<(message: string) => void>(() => {});

/** Shows one toast at a time to everything inside it; a new message replaces the old one. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback((message: string) => {
    setToast((current) => ({ id: (current?.id ?? 0) + 1, message, leaving: false }));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = toast.leaving
      ? setTimeout(() => setToast(null), FADE_MS)
      : setTimeout(() => setToast({ ...toast, leaving: true }), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ShowToast.Provider value={show}>
      {children}
      {/* Always in the page, so screen readers announce each new message. */}
      <div className={styles.region} role="status">
        {toast && (
          <p key={toast.id} className={`${styles.toast} ${toast.leaving ? styles.leaving : ""}`}>
            {toast.message}
          </p>
        )}
      </div>
    </ShowToast.Provider>
  );
}

/** `const showToast = useToast(); showToast("Invite link copied.");` */
export function useToast() {
  return useContext(ShowToast);
}
