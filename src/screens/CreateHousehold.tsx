import { useState } from "react";
import { HOUSEHOLD_NAME_MAX_LENGTH } from "../../shared/api.ts";
import { createHousehold, type Household } from "../api/households.ts";
import Button from "../components/Button.tsx";
import TextField from "../components/TextField.tsx";
import Screen, { Actions, FormError } from "./Screen.tsx";

// SCRUM-4 Create a Household (Figma "iPhone 17 - 5").

const MAX_NAME = HOUSEHOLD_NAME_MAX_LENGTH;

const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: `Please enter a household name between 1 and ${MAX_NAME} characters.`,
  ALREADY_IN_HOUSEHOLD: "You're already in a household, so you can't create another one.",
  UNAUTHENTICATED: "You need to be signed in to create a household.",
  NETWORK_ERROR: "Couldn't reach the server. Check your connection and try again.",
};
const FALLBACK_ERROR = "Something went wrong. Please try again.";

type CreateHouseholdProps = {
  onCreated: (household: Household) => void;
  onBack: () => void;
};

export default function CreateHousehold({ onCreated, onBack }: CreateHouseholdProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<{ onField: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmed = name.trim();

    // Catch obvious mistakes before calling the server
    if (trimmed.length === 0) return setError({ onField: true, message: "Please enter a household name." });
    if (trimmed.length > MAX_NAME) {
      return setError({ onField: true, message: `That name is too long. Use ${MAX_NAME} characters or fewer.` });
    }

    setError(null);
    setSubmitting(true);
    const result = await createHousehold(trimmed);
    setSubmitting(false); // the form stays usable after any outcome

    if (result.ok) return onCreated(result.household);
    setError({
      onField: result.code === "VALIDATION_ERROR",
      message: ERROR_MESSAGES[result.code] ?? FALLBACK_ERROR,
    });
  }

  return (
    <Screen title="Create Household" onSubmit={handleSubmit}>
      <TextField
        label="Household Name"
        placeholder="Enter household name"
        autoComplete="off"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={submitting}
        error={error?.onField ? error.message : null}
      />
      <Actions>
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? "Creating…" : "Create a household"}
        </Button>
        <FormError message={error && !error.onField ? error.message : null} />
        <Button variant="outline" fullWidth onClick={onBack} disabled={submitting}>
          Back
        </Button>
      </Actions>
    </Screen>
  );
}
