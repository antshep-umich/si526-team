import { useState } from "react";
import type { Household } from "../api/households.ts";
import Button from "../components/Button.tsx";
import Chip from "../components/Chip.tsx";
import styles from "./HouseholdCreated.module.css";
import Screen, { Actions, Intro } from "./Screen.tsx";

// SCRUM-4 Create a Household, "Household Created!" (Figma "iPhone 17 - 6").

type HouseholdCreatedProps = {
  household: Household;
  /** The signed-in user's id, so their row says "You". */
  userId: string;
  onContinue: () => void;
};

export default function HouseholdCreated({ household, userId, onContinue }: HouseholdCreatedProps) {
  // Not designed yet (placeholder): the button label confirms the copy.
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(household.inviteCode);
      setCopy("copied");
      setTimeout(() => setCopy("idle"), 2000);
    } catch {
      setCopy("failed");
    }
  }

  return (
    <Screen title="Household Created!" tight>
      <Intro>{household.name} is ready. Share the invite code so your housemates can join.</Intro>

      <section className={styles.card} aria-label="Invite code">
        <p className={styles.overline}>Invite code</p>
        <p className={styles.code}>{household.inviteCode}</p>
        <Button variant="outline" fullWidth onClick={copyCode}>
          {copy === "copied" ? "Copied!" : "Copy code"}
        </Button>
        <p className={styles.hint} role="status">
          {copy === "failed"
            ? "Couldn't copy automatically. Tap the code to select it, then copy."
            : "Housemates enter this code on “Join a household”."}
        </p>
      </section>

      <section className={styles.members}>
        <h2 className={styles.membersLabel}>Members ({household.members.length})</h2>
        <ul className={styles.memberList}>
          {household.members.map((member) => (
            <li key={member.userId} className={styles.member}>
              {member.userId === userId ? "You" : member.name}
              {member.role === "owner" && <Chip tone="success">Owner</Chip>}
            </li>
          ))}
        </ul>
      </section>

      <Actions>
        <Button fullWidth onClick={onContinue}>
          Go to household
        </Button>
      </Actions>
    </Screen>
  );
}
