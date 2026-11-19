import { useState } from "react";
import TabFilter from "../components/TabFilter.tsx";
import { savedTheme, setTheme, type ThemeChoice } from "../theme.ts";
import styles from "./Profile.module.css";

// The Appearance section at the end of the profile: System, Light or Dark (README
// Conflicts row 49). Not in Figma yet: built like the profile's other sections, with the
// All / Mine switch (TabFilter). It applies at once, so there's no Save button, and it's
// kept on this device only (src/theme.ts).

const CHOICES = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
] as const;

export default function AppearanceSection() {
  const [choice, setChoice] = useState<ThemeChoice>(savedTheme);

  return (
    <section className={styles.section} aria-labelledby="appearance-heading">
      <div className={styles.sectionHeader}>
        <h2 id="appearance-heading" className={styles.sectionTitle}>
          Appearance
        </h2>
        <p className={styles.intro}>System follows your phone's light or dark setting. Saved on this device.</p>
      </div>
      <TabFilter
        label="Appearance"
        options={CHOICES}
        selected={choice}
        onSelect={(next) => {
          setChoice(next);
          setTheme(next);
        }}
      />
    </section>
  );
}
