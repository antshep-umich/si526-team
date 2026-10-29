import { useEffect, useState } from "react";
import { createChore } from "../api/chores.ts";
import { getCurrentHousehold, type Household } from "../api/households.ts";
import Button from "../components/Button.tsx";
import DateField from "../components/DateField.tsx";
import PickerField from "../components/PickerField.tsx";
import TextArea from "../components/TextArea.tsx";
import TextField from "../components/TextField.tsx";
import { today as localToday } from "../dates.ts";
import { CHORE_NAME_MAX_LENGTH, CHORE_NOTES_MAX_LENGTH, type ChoreResponse } from "../../shared/chores.ts";
import styles from "./AddChore.module.css";
import { FormError } from "./Screen.tsx";

// SCRUM-6 Add a Chore (Figma "Home - Add Chore (refined)").

type AddChoreProps = {
  household: Household;
  userId: string;
  onAdded: (chore: ChoreResponse) => void;
  onCancel: () => void;
};

type Errors = Partial<Record<"name" | "assignee" | "dueDate" | "notes", string>>;

const SAVE_FAILED = "Couldn't save this chore. Please try again.";

/** Every problem with the form at once (SCRUM-6), checked before anything is sent. */
function validate(name: string, assigneeId: string | null, dueDate: string, notes: string, today: string): Errors {
  const errors: Errors = {};
  const trimmed = name.trim();
  if (!trimmed) errors.name = "Chore name is required.";
  else if (trimmed.length > CHORE_NAME_MAX_LENGTH) errors.name = "Chore name must be 60 characters or fewer.";
  if (!assigneeId) errors.assignee = "Choose who this chore is assigned to.";
  if (!dueDate) errors.dueDate = "Choose a due date.";
  else if (dueDate < today) errors.dueDate = "Due date can't be in the past.";
  if (notes.trim().length > CHORE_NOTES_MAX_LENGTH) errors.notes = "Notes must be 200 characters or fewer.";
  return errors;
}

export default function AddChore({ household: initialHousehold, userId, onAdded, onCancel }: AddChoreProps) {
  // Re-read the household so anyone who joined since log in can be picked.
  const [household, setHousehold] = useState(initialHousehold);
  const [name, setName] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const today = localToday();

  useEffect(() => {
    let cancelled = false;
    getCurrentHousehold().then((result) => {
      if (!cancelled && result.ok) setHousehold(result.household);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // "You" first: the person adding the chore, addressed directly.
  const me = household.members.find((member) => member.userId === userId);
  const others = household.members.filter((member) => member.userId !== userId);
  const options = [
    ...(me ? [{ value: me.userId, label: "You" }] : []),
    ...others.map((member) => ({ value: member.userId, label: member.name })),
  ];
  const onlyMember = others.length === 0;

  async function handleSubmit() {
    const found = validate(name, assigneeId, dueDate, notes, today);
    setErrors(found);
    setSaveError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    const result = await createChore({
      name: name.trim(),
      assigneeId: assigneeId!,
      dueDate,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
    setSaving(false);

    if (result.ok) return onAdded(result.chore);
    // The server checks the date against its own clock, so a phone that's a day ahead
    // can still be told the date has passed.
    if (result.code === "DUE_DATE_IN_PAST") return setErrors({ dueDate: "Due date can't be in the past." });
    if (result.code === "ASSIGNEE_NOT_IN_HOUSEHOLD") {
      return setErrors({ assignee: "That person isn't in your household any more. Choose someone else." });
    }
    setSaveError(SAVE_FAILED);
  }

  return (
    <main className={styles.page}>
      <form
        className={styles.stack}
        noValidate
        onSubmit={(e) => {
          e.preventDefault(); // stop the browser reloading the page
          handleSubmit();
        }}
      >
        <div className={styles.titles}>
          <p className={styles.overline}>{household.name}</p>
          <h1 className={styles.title}>Add chore</h1>
        </div>
        <div className={styles.form}>
          <TextField
            label="Chore name"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <PickerField
            label="Assigned to"
            placeholder="Select a housemate"
            options={options}
            value={assigneeId}
            onChange={setAssigneeId}
            error={errors.assignee}
            hint={
              onlyMember ? `Invite housemates with code ${household.inviteCode} to assign chores to them.` : undefined
            }
          />
          <DateField
            label="Due date"
            placeholder="Pick a date"
            value={dueDate}
            min={today}
            onChange={setDueDate}
            error={errors.dueDate}
          />
          <TextArea
            label="Notes (optional)"
            placeholder="Add any details…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            error={errors.notes}
          />
        </div>
        <div className={styles.actions}>
          <FormError message={saveError} />
          <Button type="submit" fullWidth disabled={saving}>
            {saving ? "Adding…" : "Add chore"}
          </Button>
          <Button type="button" variant="outline" fullWidth onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </main>
  );
}
