import { useEffect, useRef, type ReactNode } from "react";
import TabBar, { type TabId } from "../components/TabBar.tsx";
import { MenuProvider, type MenuActions } from "./Header.tsx";
import styles from "./TabLayout.module.css";

// Every screen inside a household (the chore list, Add chore, the chore histories, the
// Schedule, the House tab) sits above the tab bar at the bottom of the view, and has the header
// menu by its title (Header). Those are the way around: the screens have no Back link,
// and each tab always opens its first screen.

type TabLayoutProps = {
  /** The tab the current screen belongs to. */
  selected: TabId;
  /** Opens a tab's first screen: the chore list, the Schedule's current week, or the House page. */
  onSelect: (tab: TabId) => void;
  /** What the header menu's items do. */
  menu: MenuActions;
  /** Changes when another screen opens; the new screen starts scrolled to the top. */
  screen: unknown;
  children: ReactNode;
};

export default function TabLayout({ selected, onSelect, menu, screen, children }: TabLayoutProps) {
  // Only the screen scrolls, not the page (TabLayout.module.css), so it keeps its place
  // from one screen to the next unless it's sent back to the top.
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (content.current) content.current.scrollTop = 0;
  }, [screen]);

  return (
    <div className={styles.layout}>
      <div ref={content} className={styles.content}>
        <MenuProvider actions={menu}>{children}</MenuProvider>
      </div>
      <div className={styles.tabBar}>
        <TabBar selected={selected} onSelect={onSelect} />
      </div>
    </div>
  );
}
