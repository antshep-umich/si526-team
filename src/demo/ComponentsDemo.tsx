import { useEffect, useState, type ReactNode } from "react";
import Avatar from "../components/Avatar.tsx";
import Button from "../components/Button.tsx";
import ChoreCard, { type ChoreStatus } from "../components/ChoreCard.tsx";
import Chip from "../components/Chip.tsx";
import NoteCard from "../components/NoteCard.tsx";
import OverdueBanner from "../components/OverdueBanner.tsx";
import ProgressCard from "../components/ProgressCard.tsx";
import TabBar, { type TabId } from "../components/TabBar.tsx";
import TextField from "../components/TextField.tsx";
import styles from "./ComponentsDemo.module.css";
import Measured from "./Measured.tsx";

// Every component from the Figma "Components" page, laid out like its
// "Component list" frame. Served at /components.html; not part of the app.
// The app always follows the device's light/dark setting; this dev page can override it.

type Theme = "system" | "light" | "dark";
const THEME_KEY = "jaals-demo-theme";

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // storage unavailable (private window): fall back to the system setting
  }
  return "system";
}

const COLOR_TOKENS = [
  "background-top",
  "background-bottom",
  "surface-card",
  "surface-tab-bar",
  "border-default",
  "border-input",
  "progress-track",
  "text-default",
  "text-muted",
  "action-primary",
  "action-on-primary",
  "action-focus-ring",
  "success-default",
  "success-on-success",
  "success-chip",
  "success-chip-text",
  "overdue-fill",
  "overdue-on-fill",
  "overdue-tint",
  "overdue-line",
  "error-border",
  "error-text",
];

const TYPE_STYLES = [
  ["screen-title", "Serif / Screen title", "Bold 28/34"],
  ["section-title", "Serif / Section title", "Bold 20/26"],
  ["chore-name", "Serif / Chore name", "Bold 17/22"],
  ["reading", "Serif / Reading", "Regular 16/24"],
  ["note", "Serif / Note", "Italic 16/24"],
  ["body", "Sans / Body", "Regular 15/22"],
  ["button", "Sans / Button", "SemiBold 15/20"],
  ["small", "Sans / Small", "Regular 14/20"],
  ["field-label", "Sans / Field label", "Bold 13/18"],
  ["meta", "Sans / Meta", "Regular 13/18"],
  ["chip", "Sans / Chip", "Bold 12/16"],
  ["tab-label", "Sans / Tab label", "SemiBold 12/16"],
  ["overline", "Sans / Overline", "Bold 12/16, 8% tracking"],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.overline}>{title}</h2>
      {children}
    </section>
  );
}

export default function ComponentsDemo() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [showSizes, setShowSizes] = useState(false);
  const [chores, setChores] = useState<{ name: string; details: string; status: ChoreStatus }[]>([
    { name: "Take out trash", details: "Overdue · Riley · due Monday", status: "overdue" },
    { name: "Clean bathroom", details: "You · due today", status: "pending" },
    { name: "Wash dishes", details: "Jordan · done 9:40 AM", status: "done" },
  ]);
  const [choreName, setChoreName] = useState("Mop kitchen");
  const [tab, setTab] = useState<TabId>("chores");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      if (theme === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, theme);
    } catch {
      // not saved; the switch still works for this visit
    }
  }, [theme]);

  function toggleChore(index: number) {
    setChores((list) =>
      list.map((chore, i) =>
        i === index ? { ...chore, status: chore.status === "done" ? "pending" : "done" } : chore,
      ),
    );
  }

  const doneCount = chores.filter((c) => c.status === "done").length;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Components</h1>
        <p className={styles.subtitle}>
          From the Figma “App Design” file, Components page. Sizes are CSS pixels.
        </p>
        <div className={styles.controls}>
          <div className={styles.segmented} role="radiogroup" aria-label="Theme">
            {(["system", "light", "dark"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={theme === option}
                className={styles.segment}
                onClick={() => setTheme(option)}
              >
                {option[0]!.toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
          <label className={styles.toggle}>
            <input type="checkbox" checked={showSizes} onChange={(e) => setShowSizes(e.target.checked)} />
            Show sizes
          </label>
        </div>
      </header>

      <Section title="Buttons · default, outline, keyboard focus">
        <div className={styles.row}>
          <Measured show={showSizes}>
            <Button>Add chore</Button>
          </Measured>
          <Measured show={showSizes}>
            <Button variant="outline">Swap with someone</Button>
          </Measured>
          <Measured show={showSizes}>
            <Button data-force-focus="">Add chore</Button>
          </Measured>
        </div>
        <p className={styles.hint}>
          The focus ring appears when you Tab to a button. The third one shows it all the time.
        </p>
        <div className={styles.column}>
          <Measured show={showSizes} block>
            <Button fullWidth>Create a household</Button>
          </Measured>
          <Measured show={showSizes} block>
            <Button variant="outline" fullWidth>
              Join with a code
            </Button>
          </Measured>
        </div>
      </Section>

      <Section title="Chips">
        <div className={styles.row}>
          <Measured show={showSizes}>
            <Chip tone="overdue">Overdue</Chip>
          </Measured>
          <Measured show={showSizes}>
            <Chip tone="success">Done</Chip>
          </Measured>
        </div>
      </Section>

      <Section title="Overdue banner">
        <Measured show={showSizes} block>
          <OverdueBanner
            title="1 chore is overdue"
            message="Take out trash was due Monday."
            onAction={() => alert("Review overdue chores")}
          />
        </Measured>
      </Section>

      <Section title="Progress">
        <Measured show={showSizes} block>
          <ProgressCard done={5} total={8} status="On track" />
        </Measured>
      </Section>

      <Section title="Chore cards · overdue, pending, done">
        <div className={styles.cards}>
          {chores.map((chore, i) => (
            <Measured key={chore.name} show={showSizes} block>
              <ChoreCard {...chore} onToggle={() => toggleChore(i)} />
            </Measured>
          ))}
        </div>
        <p className={styles.hint}>
          Tap a checkbox to mark a chore done or not done. {doneCount} of {chores.length} done.
        </p>
      </Section>

      <Section title="Note">
        <Measured show={showSizes} block>
          <NoteCard from="Sam" note="Left the spare key under the blue planter." />
        </Measured>
      </Section>

      <Section title="Text fields · default, blocking error">
        <div className={styles.cards}>
          <Measured show={showSizes} block>
            <TextField label="Text field" value={choreName} onChange={(e) => setChoreName(e.target.value)} />
          </Measured>
          <Measured show={showSizes} block>
            <TextField label="Text field (error)" placeholder="Chore name" error="Give the chore a name first." />
          </Measured>
        </div>
      </Section>

      <Section title="Avatars">
        <div className={styles.row}>
          {["Anthony Shephard", "Riley Jones", "Sam Martin"].map((name) => (
            <Measured key={name} show={showSizes}>
              <Avatar name={name} />
            </Measured>
          ))}
        </div>
      </Section>

      <Section title="Tab bar">
        <Measured show={showSizes} block>
          <TabBar selected={tab} onSelect={setTab} />
        </Measured>
        <p className={styles.hint}>Tap a tab to select it.</p>
      </Section>

      <Section title="Colors">
        <ul className={styles.swatches}>
          {COLOR_TOKENS.map((token) => (
            <li key={token} className={styles.swatch}>
              <span className={styles.chipColor} style={{ background: `var(--color-${token})` }} />
              <code>--color-{token}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type">
        <ul className={styles.typeList}>
          {TYPE_STYLES.map(([token, name, spec]) => (
            <li key={token}>
              <p
                style={{
                  font: `var(--type-${token})`,
                  ...(token === "overline"
                    ? { letterSpacing: "var(--tracking-overline)", textTransform: "uppercase" }
                    : {}),
                }}
              >
                {name}
              </p>
              <p className={styles.hint}>
                --type-{token} · {spec}
              </p>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}
