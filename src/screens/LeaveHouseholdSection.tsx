import { useEffect, useId, useRef, useState } from "react";
import { getCurrentHousehold, leaveHousehold, type Household } from "../api/households.ts";
import Button from "../components/Button.tsx";
import Collapse from "../components/Collapse.tsx";
import styles from "./Profile.module.css";
import { FormError } from "./Screen.tsx";

// SCRUM-75 Leave a household: the last part of your profile. Not in Figma yet
// (placeholder): an outline button, and the story's confirmation rolling down under it
// with Leave and Cancel (README Conflicts row 52).

type Props = {
  household: Household;
  /** The user is out of the household: show "Your household" (AC3). */
  onLeft: () => void;
};

export const LEAVE_FAILED = "Something went wrong. Please try again.";

/** The story's two confirmations: the usual one (AC1), and the last member's (AC9). */
export function leaveMessage(household: Household): string {
  return household.members.length <= 1
    ? `You’re the last member of ${household.name}. Leaving will delete the household and all of its chores.`
    : `Leave ${household.name}? Your open chores will become unassigned.`;
}

export default function LeaveHouseholdSection({ household, onLeft }: Props) {
  const id = useId();
  const [confirming, setConfirming] = useState<Household | null>(null);
  const [checking, setChecking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // The confirmation takes focus, on its safe choice.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  async function ask() {
    // Housemates may have joined or left since the household loaded, which changes the question.
    setChecking(true);
    const fresh = await getCurrentHousehold();
    setChecking(false);
    setError(null);
    setConfirming(fresh.ok ? fresh.household : household);
  }

  async function leave() {
    setLeaving(true);
    setError(null);
    const result = await leaveHousehold();
    setLeaving(false);
    if (!result.ok) return setError(LEAVE_FAILED);
    onLeft();
  }

  const shown = confirming ?? household;
  return (
    <section className={styles.section} aria-label="Leave household">
      <div>
        <Button
          variant="outline"
          onClick={() => (confirming ? setConfirming(null) : ask())}
          disabled={checking}
          aria-expanded={confirming !== null}
          aria-controls={`${id}-confirm`}
        >
          Leave household
        </Button>
      </div>
      <Collapse open={confirming !== null} id={`${id}-confirm`}>
        <div className={styles.form} role="alertdialog" aria-labelledby={`${id}-question`}>
          <p id={`${id}-question`} className={styles.intro}>
            {leaveMessage(shown)}
          </p>
          <FormError message={error} />
          <div className={styles.buttons}>
            <Button onClick={leave} disabled={leaving}>
              {leaving ? "Leaving…" : "Leave"}
            </Button>
            <Button ref={cancelRef} variant="outline" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </Collapse>
    </section>
  );
}
