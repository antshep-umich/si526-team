import { useEffect, useState } from "react";
import type { HouseholdMember } from "../../shared/api.ts";
import { getCurrentHousehold, type Household } from "../api/households.ts";
import Avatar from "../components/Avatar.tsx";
import Button from "../components/Button.tsx";
import ThemedIcon from "../components/ThemedIcon.tsx";
import { useToast } from "../components/Toast.tsx";
import { inviteLink } from "../inviteLink.ts";
import { usePolling } from "../usePolling.ts";
import Header from "./Header.tsx";
import styles from "./House.module.css";

// SCRUM-74 House Page. Not in Figma yet (placeholder): built from the design system as agreed
// in docs/superpowers/specs/2026-11-15-house-tab-design.md (README Conflicts rows 30 and 31).

type HouseProps = {
  /** The signed-in user, whose row says "You". */
  userId: string;
  /** Opens a housemate's profile (a placeholder until SCRUM-72 and SCRUM-63). */
  onOpenHousemate: (member: HouseholdMember) => void;
};

type State = { status: "loading" } | { status: "failed" } | { status: "ready"; household: Household };

export default function House({ userId, onOpenHousemate }: HouseProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [inviting, setInviting] = useState(false);
  const showToast = useToast();

  useEffect(() => {
    let cancelled = false;
    getCurrentHousehold().then((result) => {
      if (!cancelled) setState(result.ok ? { status: "ready", household: result.household } : { status: "failed" });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Housemates who join or leave show up without a refresh; a failed check changes nothing.
  usePolling(() => {
    getCurrentHousehold().then((result) => {
      if (result.ok) setState({ status: "ready", household: result.household });
    });
  }, state.status === "ready");

  if (state.status !== "ready") {
    return (
      <main className={styles.page}>
        <Header title="House" />
        {state.status === "loading" ? (
          // Not in Figma yet (placeholder): the loading indicator.
          <p className={styles.message} role="status">
            Loading your household…
          </p>
        ) : (
          <div className={styles.failed}>
            <p className={styles.message} role="alert">
              We couldn't load your household. Please try again.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setState({ status: "loading" });
                setAttempt((n) => n + 1);
              }}
            >
              Retry
            </Button>
          </div>
        )}
      </main>
    );
  }

  const { household } = state;
  const count = household.members.length;
  // You first, then everyone else in the order they joined.
  const members = [
    ...household.members.filter((m) => m.userId === userId),
    ...household.members.filter((m) => m.userId !== userId),
  ];

  async function share() {
    const url = inviteLink(household.inviteCode);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `Join ${household.name}`,
          text: `Join ${household.name} on JAALS Chore Tracker.`,
          url,
        });
        return;
      } catch (error) {
        // Closing the share sheet does nothing; any other failure falls back to copying.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Invite link copied.");
    } catch {
      // Not in the story: neither sharing nor copying works in this browser.
      showToast("Couldn't copy the invite link. Press and hold the code to copy it instead.");
    }
  }

  return (
    <main className={styles.page}>
      <Header title={household.name}>
        <p className={styles.count}>{count === 1 ? "1 member" : `${count} members`}</p>
      </Header>

      {/* No household managers until SCRUM-62: no "Become household manager" button yet (row 30). */}
      <section className={`${styles.card} ${styles.manager}`} aria-label="Household manager">
        <span className={styles.managerAvatar} aria-hidden="true">
          ?
        </span>
        <div>
          <p className={styles.managerLabel}>Household manager</p>
          <p className={styles.managerName}>No Household Manager assigned</p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="housemates-title">
        <h2 id="housemates-title" className={styles.sectionTitle}>
          Housemates
        </h2>
        <ul className={`${styles.card} ${styles.rows}`}>
          {members.map((member) => {
            const you = member.userId === userId;
            return (
              <li key={member.userId} className={styles.row}>
                <button
                  type="button"
                  className={styles.rowButton}
                  aria-label={you ? `${member.name} (You)` : member.name}
                  onClick={() => onOpenHousemate(member)}
                >
                  <Avatar name={member.name} />
                  <span className={styles.name}>{member.name}</span>
                  {you && <span className={styles.you}>You</span>}
                  <ThemedIcon name="chevronDown" className={styles.chevron} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {inviting ? (
        <section className={`${styles.card} ${styles.invite}`} aria-label="Invite code">
          <p className={styles.overline}>Invite code</p>
          <p className={styles.code}>{household.inviteCode}</p>
          <p className={styles.hint}>Share this code so your housemates can join.</p>
          <button type="button" className={styles.share} aria-label="Share invite link" onClick={share}>
            <ThemedIcon name="share" />
          </button>
        </section>
      ) : (
        <Button variant="outline" fullWidth onClick={() => setInviting(true)}>
          Invite housemates
        </Button>
      )}
    </main>
  );
}
