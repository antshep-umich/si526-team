import type { ReactNode } from "react";
import TabBar from "../components/TabBar.tsx";
import styles from "./TabLayout.module.css";

// Every screen inside a household (the chore list, Add chore and the chore histories)
// sits above the tab bar, fixed to the bottom of the view. The tab bar is the way
// around: those screens have no Back link, and Chores always returns to the chore list.

type TabLayoutProps = {
  /** Opens the chore list. */
  onChores: () => void;
  children: ReactNode;
};

export default function TabLayout({ onChores, children }: TabLayoutProps) {
  return (
    <div className={styles.layout}>
      {children}
      <div className={styles.tabBar}>
        {/* Schedule and House have no screens yet (README Conflicts row 20). */}
        <TabBar selected="chores" onSelect={(tab) => tab === "chores" && onChores()} available={["chores"]} />
      </div>
    </div>
  );
}
