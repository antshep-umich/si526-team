import type { Household } from "../api/households.ts";
import type { Chore } from "../chores.ts";
import type { ChoreResponse } from "../../shared/chores.ts";
import ChoreForm from "./ChoreForm.tsx";

// Edit chore (Figma "Home - Edit chore", 635:616), opened from the pencil in a chore's
// dropdown on Home (SCRUM-7 AC11). The same form as Add chore, filled in. Only the
// household owner or the chore's creator get here (canEditChore); the API checks too.

type EditChoreProps = {
  household: Household;
  userId: string;
  chore: Chore;
  onSaved: (chore: ChoreResponse) => void;
  onCancel: () => void;
};

export default function EditChore(props: EditChoreProps) {
  return <ChoreForm {...props} />;
}
