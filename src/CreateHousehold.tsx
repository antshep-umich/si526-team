import { useState, type FormEvent } from "react";
import { createHousehold, type Household } from "./api/households.ts";

const MAX_NAME = 60;

const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: `Please enter a household name between 1 and ${MAX_NAME} characters.`,
  ALREADY_IN_HOUSEHOLD: "You're already in a household, so you can't create another one.",
  UNAUTHENTICATED: "You need to be signed in to create a household.",
  NETWORK_ERROR: "Couldn't reach the server. Check your connection and try again.",
};
const FALLBACK_ERROR = "Something went wrong. Please try again.";

export default function CreateHousehold() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [household, setHousehold] = useState<Household | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); // stop the browser reloading the page
    const trimmed = name.trim();

    // Catch obvious mistakes before calling the server
    if (trimmed.length === 0) return setError("Please enter a household name.");
    if (trimmed.length > MAX_NAME) {
      return setError(`That name is too long. Use ${MAX_NAME} characters or fewer.`);
    }

    setError(null);
    setSubmitting(true);
    const result = await createHousehold(trimmed);
    setSubmitting(false); // the form stays usable after any outcome

    if (result.ok) setHousehold(result.household);
    else setError(ERROR_MESSAGES[result.code] ?? FALLBACK_ERROR);
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  if (household) {
    return (
      <section>
        <h2>{household.name} is ready!</h2>
        <p>Share this invite code with your housemates:</p>
        <p>
          <strong>{household.inviteCode}</strong>{" "}
          <button type="button" onClick={() => copyCode(household.inviteCode)}>
            Copy code
          </button>
        </p>
        <p role="status">
          {copyStatus === "copied" && "Copied!"}
          {copyStatus === "failed" && "Couldn't copy automatically. Select the code and copy it."}
        </p>
        <p>You are the owner. Members: {household.members.length}</p>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2>Create a household</h2>
      <label htmlFor="household-name">Household name</label>{" "}
      <input
        id="household-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={submitting}
      />{" "}
      <small>
        {name.trim().length}/{MAX_NAME}
      </small>{" "}
      <button type="submit" disabled={submitting}>
        {submitting ? "Creating…" : "Create household"}
      </button>
      <p role="alert">{error}</p>
    </form>
  );
}