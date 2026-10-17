import styles from "./TabBar.module.css";
import ThemedIcon from "./ThemedIcon.tsx";

// The app's three tabs, as in Figma (Tab bar: Selected=Chores | Schedule | House).
export const TABS = [
  { id: "chores", label: "Chores", icon: "tabChores", activeIcon: "tabChoresActive" },
  { id: "schedule", label: "Schedule", icon: "tabSchedule", activeIcon: "tabScheduleActive" },
  { id: "house", label: "House", icon: "tabHouse", activeIcon: "tabHouseActive" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

type TabBarProps = {
  selected: TabId;
  /** Called with the tab the user picked. */
  onSelect: (tab: TabId) => void;
};

export default function TabBar({ selected, onSelect }: TabBarProps) {
  return (
    <nav className={styles.bar} aria-label="Main">
      {TABS.map((tab) => {
        const active = tab.id === selected;
        return (
          <button
            key={tab.id}
            type="button"
            className={`${styles.tab} ${active ? styles.active : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={() => onSelect(tab.id)}
          >
            <ThemedIcon name={active ? tab.activeIcon : tab.icon} />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
