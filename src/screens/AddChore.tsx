import type { Household } from "../api/households.ts";
import type { ChoreResponse } from "../../shared/chores.ts";
import ChoreForm from "./ChoreForm.tsx";

// SCRUM-6 Add a Chore (Figma "Home - Add Chore (refined)"). The form is ChoreForm.tsx.

type AddChoreProps = {
  household: Household;
  userId: string;
  onAdded: (chore: ChoreResponse) => void;
  onCancel: () => void;
};

export default function AddChore({ onAdded, ...props }: AddChoreProps) {
  return <ChoreForm {...props} onSaved={onAdded} />;
}
