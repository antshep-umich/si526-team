import type { HouseholdMember } from "../../shared/api.ts";
import Avatar from "../components/Avatar.tsx";
import Header from "./Header.tsx";
import styles from "./House.module.css";

// Not built yet (placeholder): a housemate's profile, opened from the House tab (SCRUM-74 AC2).
// SCRUM-72 (profile) and SCRUM-63 (preferred chores) replace it; leaving a household
// (SCRUM-75) will live there too (README Conflicts row 30).

export default function HousemateProfile({ member }: { member: HouseholdMember }) {
  return (
    <main className={styles.page}>
      <Header overline="Housemate" title={member.name} />
      <section className={`${styles.card} ${styles.manager}`} aria-label="Profile">
        <Avatar name={member.name} />
        <p className={styles.managerName}>Profiles are coming soon.</p>
      </section>
    </main>
  );
}
