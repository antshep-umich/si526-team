import type { ReactNode } from "react";
import TabBar from "../components/TabBar.tsx";
import { MenuProvider, type MenuActions } from "./Header.tsx";
import styles from "./TabLayout.module.css";

// Every screen inside a household (the chore list, Add chore and the chore histories)
// sits above the tab bar, fixed to the bottom of the view, and has the header menu by
// its title (Header). Those are the way around: the screens have no Back link,
// and Chores always returns to the chore list.

type TabLayoutProps = {
  /** Opens the chore list. */
  onChores: () => void;
  /** What the header menu's items do. */
  menu: MenuActions;
  children: ReactNode;
};

export default function TabLayout({ onChores, menu, children }: TabLayoutProps) {
  return (
    <div className={styles.layout}>
      <MenuProvider actions={menu}>{children}</MenuProvider>
      <div className={styles.tabBar}>
        {/* Schedule and House have no screens yet (README Conflicts row 20). */}
        <TabBar selected="chores" onSelect={(tab) => tab === "chores" && onChores()} available={["chores"]} />
      </div>
    </div>
  );
}
