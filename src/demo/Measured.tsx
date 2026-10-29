import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import styles from "./ComponentsDemo.module.css";

/**
 * Wraps one component and, when `show` is on, prints its rendered size in CSS
 * pixels underneath, to compare with Figma. `block` for full-width components.
 */
export default function Measured({ show, block = false, children }: { show: boolean; block?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<string | null>(null);

  useLayoutEffect(() => {
    const target = ref.current?.firstElementChild;
    if (!show || !target) return;
    const measure = () => {
      const { width, height } = target.getBoundingClientRect();
      setSize(`${Math.round(width * 10) / 10} × ${Math.round(height * 10) / 10}`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => observer.disconnect();
  }, [show]);

  return (
    <div className={block ? styles.measuredBlock : styles.measured} data-show={show || undefined}>
      <div ref={ref} className={styles.measuredBody}>
        {children}
      </div>
      {show && <span className={styles.size}>{size}</span>}
    </div>
  );
}
