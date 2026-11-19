import { useEffect, useState } from "react";
import { createChore, editChore } from "../api/chores.ts";
import { getCurrentHousehold, type Household } from "../api/households.ts";
import Button from "../components/Button.tsx";
import DateField from "../components/DateField.tsx";
import PickerField from "../components/PickerField.tsx";
import TextArea from "../components/TextArea.tsx";
import TextField from "../components/TextField.tsx";
import type { Chore } from "../chores.ts";
import { today as localToday } from "../dates.ts";
import { CHORE_NAME_MAX_LENGTH, CHORE_NOTES_MAX_LENGTH, type ChoreResponse } from "../../shared/chores.ts";
import Header from "./Header.tsx";
import styles from "./ChoreForm.module.css";
import { FormError } from "./Screen.tsx";

// The chore form: SCRUM-6 Add a Chore (Figma "Home - Add Chore (refined)"), and Edit
// chore (Figma "Home - Edit chore", 635:616), the same fields filled in with the chore's
// (SCRUM-7 AC11, SCRUM-62). AddChore.tsx and EditChore.tsx choose which.

type ChoreFormProps = {
  household: Household;
  userId: string;
  /** The chore to edit. Without it, the form adds a new one. */
  chore?: Chore;
  onSaved: (chore: ChoreResponse) => void;
  onCancel: () => void;
};

type Errors = Partial<Record<"name" | "assignee" | "dueDate" | "notes", string>>;

const SAVE_FAILED = "Couldn't save this chore. Please try again.";

/**
 * Every problem with the form at once (SCRUM-6), checked before anything is sent.
 * `keptDueDate`, an edited chore's due date, may stay even if it has passed.
 */
function validate(
  name: string,
  assigneeId: string | null,
  dueDate: string,
  notes: string,
  today: string,
  keptDueDate?: string,
): Errors {
  const errors: Errors = {};
  const trimmed = name.trim();
  if (!trimmed) errors.name = "Chore name is required.";
  else if (trimmed.length > CHORE_NAME_MAX_LENGTH) errors.name = "Chore name must be 60 characters or fewer.";
  if (!assigneeId) errors.assignee = "Choose who this chore is assigned to.";
  if (!dueDate) errors.dueDate = "Choose a due date.";
  else if (dueDate < today && dueDate !== keptDueDate) errors.dueDate = "Due date can't be in the past.";
  if (notes.trim().length > CHORE_NOTES_MAX_LENGTH) errors.notes = "Notes must be 200 characters or fewer.";
  return errors;
}

export default function ChoreForm({ household: initialHousehold, userId, chore, onSaved, onCancel }: ChoreFormProps) {
  // Re-read the household so anyone who joined since log in can be picked.
  const [household, setHousehold] = useState(initialHousehold);
  const [name, setName] = useState(chore?.name ?? "");
  const [assigneeId, setAssigneeId] = useState<string | null>(chore?.assignee?.userId ?? null);
  const [dueDate, setDueDate] = useState(chore?.dueDate ?? "");
  const [notes, setNotes] = useState(chore?.notes ?? "");
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
    const found = validate(name, assigneeId, dueDate, notes, today, chore?.dueDate);
    setErrors(found);
    setSaveError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    const fields = {
      name: name.trim(),
      assigneeId: assigneeId!,
      dueDate,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    const result = chore ? await editChore(chore.id, fields) : await createChore(fields);
    setSaving(false);

    if (result.ok) return onSaved(result.chore);
    // The server checks the date against its own clock, so a phone that's a day ahead
    // can still be told the date has passed.
    if (result.code === "DUE_DATE_IN_PAST") return setErrors({ dueDate: "Due date can't be in the past." });
    if (result.code === "ASSIGNEE_NOT_IN_HOUSEHOLD") {
      return setErrors({ assignee: "That person isn't in your household any more. Choose someone else." });
    }
    // Not designed yet (placeholders): someone else changed who may edit, or deleted the chore.
    if (result.code === "NOT_ALLOWED_TO_EDIT") {
      return setSaveError("Only the household owner or the person who added this chore can edit it.");
    }
    if (result.code === "CHORE_NOT_FOUND") return setSaveError("Chore no longer available.");
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
        <Header overline={household.name} title={chore ? "Edit chore" : "Add chore"} />
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
            {chore ? (saving ? "Saving…" : "Save chore") : saving ? "Adding…" : "Add chore"}
          </Button>
          <Button type="button" variant="outline" fullWidth onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </main>
  );
}
