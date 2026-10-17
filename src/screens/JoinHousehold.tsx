import { useState } from "react";
import { joinHousehold, type Household } from "../api/households.ts";
import Button from "../components/Button.tsx";
import TextField from "../components/TextField.tsx";
import TextLink from "../components/TextLink.tsx";
import Screen, { Actions, FormError } from "./Screen.tsx";

// SCRUM-5 Join a Household (Figma "iPhone 17 - 4").

const FIELD_ERRORS: Record<string, string> = {
  VALIDATION_ERROR: "Enter the invite code from your housemate.",
  INVITE_CODE_NOT_FOUND: "No household has that code. Check it with your housemate and try again.",
  ALREADY_IN_HOUSEHOLD: "You're already in a different household.",
};
const FORM_ERRORS: Record<string, string> = {
  NETWORK_ERROR: "Couldn't reach the server. Check your connection and try again.",
  UNAUTHENTICATED: "You need to be signed in to join a household.",
};
const FALLBACK_ERROR = "Something went wrong. Please try again.";

type JoinHouseholdProps = {
  onJoined: (household: Household) => void;
  onBack: () => void;
};

export default function JoinHousehold({ onJoined, onBack }: JoinHouseholdProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<{ onField: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!code.trim()) return setError({ onField: true, message: FIELD_ERRORS.VALIDATION_ERROR! });

    setError(null);
    setSubmitting(true);
    // The server ignores spaces, hyphens and letter case in the code.
    const result = await joinHousehold(code);
    setSubmitting(false);

    if (result.ok) return onJoined(result.household);
    const fieldMessage = FIELD_ERRORS[result.code];
    setError(
      fieldMessage
        ? { onField: true, message: fieldMessage }
        : { onField: false, message: FORM_ERRORS[result.code] ?? FALLBACK_ERROR },
    );
  }

  return (
    <Screen title="Join a household" onSubmit={handleSubmit}>
      <TextField
        label="Invite code"
        placeholder="Enter code"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        disabled={submitting}
        error={error?.onField ? error.message : null}
      />
      <Actions>
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? "Joining…" : "Join"}
        </Button>
        <FormError message={error && !error.onField ? error.message : null} />
        <TextLink onClick={onBack}>Back</TextLink>
      </Actions>
    </Screen>
  );
}
