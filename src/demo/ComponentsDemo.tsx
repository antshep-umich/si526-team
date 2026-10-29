import { useEffect, useState, type ReactNode } from "react";
import Avatar from "../components/Avatar.tsx";
import Button from "../components/Button.tsx";
import ChoreCard, { type ChoreStatus } from "../components/ChoreCard.tsx";
import Chip from "../components/Chip.tsx";
import DateField from "../components/DateField.tsx";
import DoneSection from "../components/DoneSection.tsx";
import NoteCard from "../components/NoteCard.tsx";
import OverdueBanner from "../components/OverdueBanner.tsx";
import PickerField from "../components/PickerField.tsx";
import ProgressCard from "../components/ProgressCard.tsx";
import TabBar, { type TabId } from "../components/TabBar.tsx";
import TabFilter from "../components/TabFilter.tsx";
import TextArea from "../components/TextArea.tsx";
import TextField from "../components/TextField.tsx";
import { today } from "../dates.ts";
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
  "action-primary-disabled",
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
    { name: "Take out trash", details: "You · due Mon, Oct 5", status: "overdue" },
    { name: "Clean bathroom", details: "You · due today", status: "pending" },
    { name: "Wash dishes", details: "You · done today · due today", status: "done" },
    { name: "Buy dish soap", details: "You · done today · due Fri, Oct 9", status: "late" },
  ]);
  const [choreName, setChoreName] = useState("Mop kitchen");
  const [tab, setTab] = useState<TabId>("chores");
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [doneOpen, setDoneOpen] = useState(false);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

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
        i === index
          ? { ...chore, status: chore.status === "done" || chore.status === "late" ? "pending" : "done" }
          : chore,
      ),
    );
  }

  const doneCount = chores.filter((c) => c.status === "done" || c.status === "late").length;

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

      <Section title="Buttons · default, outline, keyboard focus, disabled">
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
          <Measured show={showSizes}>
            <Button disabled>Add chore</Button>
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
          <Measured show={showSizes}>
            <Chip tone="late">Late</Chip>
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

      <Section title="Progress · on track, complete, late, empty">
        <div className={styles.cards}>
          <Measured show={showSizes} block>
            <ProgressCard done={5} total={8} />
          </Measured>
          <Measured show={showSizes} block>
            <ProgressCard done={8} total={8} />
          </Measured>
          <Measured show={showSizes} block>
            <ProgressCard done={3} total={8} late={1} />
          </Measured>
          <Measured show={showSizes} block>
            <ProgressCard done={0} total={0} />
          </Measured>
        </div>
        <p className={styles.hint}>
          The “1 Late” text is overdue/fill on white, as designed (low contrast; see the README’s design issues).
        </p>
      </Section>

      <Section title="Tab filter">
        <Measured show={showSizes} block>
          <TabFilter
            label="Show chores"
            options={[
              { id: "all", label: "All" },
              { id: "mine", label: "Mine" },
            ]}
            selected={filter}
            onSelect={setFilter}
          />
        </Measured>
      </Section>

      <Section title="Done section · tap to open and close">
        <Measured show={showSizes} block>
          <DoneSection count={2} expanded={doneOpen} onToggle={() => setDoneOpen(!doneOpen)} controls="demo-done" />
        </Measured>
        <p id="demo-done" className={styles.hint} hidden={!doneOpen}>
          The done chores show here on the chore list.
        </p>
      </Section>

      <Section title="Chore cards · overdue, pending, done, late, someone else’s">
        <div className={styles.cards}>
          {chores.map((chore, i) => (
            <Measured key={chore.name} show={showSizes} block>
              <ChoreCard {...chore} onToggle={() => toggleChore(i)} />
            </Measured>
          ))}
          <Measured show={showSizes} block>
            <ChoreCard name="Vacuum living room" details="Alex · due tomorrow" status="pending" />
          </Measured>
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

      <Section title="Text fields · default, blocking error, password">
        <div className={styles.cards}>
          <Measured show={showSizes} block>
            <TextField label="Text field" value={choreName} onChange={(e) => setChoreName(e.target.value)} />
          </Measured>
          <Measured show={showSizes} block>
            <TextField label="Text field (error)" placeholder="Chore name" error="Chore name is required." />
          </Measured>
          <Measured show={showSizes} block>
            <TextField label="Password" type="password" defaultValue="hunter22" />
          </Measured>
        </div>
        <p className={styles.hint}>Tab into a field to see the focus ring. The eye shows and hides the password.</p>
      </Section>

      <Section title="Picker fields · housemate, date">
        <div className={styles.cards}>
          <Measured show={showSizes} block>
            <PickerField
              label="Assigned to"
              placeholder="Select a housemate"
              options={[
                { value: "me", label: "You" },
                { value: "jenna", label: "Jenna White" },
                { value: "robert", label: "Robert Mann" },
              ]}
              value={assignee}
              onChange={setAssignee}
            />
          </Measured>
          <Measured show={showSizes} block>
            <DateField label="Due date" placeholder="Pick a date" value={dueDate} min={today()} onChange={setDueDate} />
          </Measured>
          <Measured show={showSizes} block>
            <PickerField
              label="Assigned to (error)"
              placeholder="Select a housemate"
              options={[{ value: "me", label: "You" }]}
              value={null}
              onChange={() => {}}
              error="Choose who this chore is assigned to."
              hint="Invite housemates with code K7Q2MXAB to assign chores to them."
            />
          </Measured>
        </div>
        <p className={styles.hint}>Tap the housemate field to open its list. The date opens the phone’s date picker.</p>
      </Section>

      <Section title="Text area">
        <Measured show={showSizes} block>
          <TextArea
            label="Notes (optional)"
            placeholder="Add any details…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Measured>
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
