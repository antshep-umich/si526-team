import styles from "./Avatar.module.css";

/** Up to two initials, from a display name: "Anthony Shephard" → "AS". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((p) => p[0]!.toUpperCase()).join("");
}

export default function Avatar({ name }: { name: string }) {
  return (
    <span className={styles.avatar} role="img" aria-label={name}>
      {initialsOf(name)}
    </span>
  );
}
