import { useState } from "react";
import { resetPassword } from "../api/passwordReset.ts";
import Button from "../components/Button.tsx";
import TextField from "../components/TextField.tsx";
import TextLink from "../components/TextLink.tsx";
import { passwordMeetsRules } from "../../shared/accounts.ts";
import { AUTH_MESSAGES, NETWORK_MESSAGE } from "./authErrors.ts";
import Screen, { Actions, FormError, Intro } from "./Screen.tsx";

// STAND-IN, not designed in Figma yet: "Forgot your password?" asks for the
// account's email, then lets the person set a new password. Same layout as the
// other Sprint 2 screens. See server/routes/passwordReset.ts for why it's temporary.

type ForgotPasswordProps = {
  initialEmail?: string;
  onDone: (email: string) => void;
  onBack: () => void;
};

export default function ForgotPassword({ initialEmail = "", onDone, onBack }: ForgotPasswordProps) {
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<{ field: "email" | "password" | "confirm" | "form"; message: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  const fieldError = (field: "email" | "password" | "confirm" | "form") =>
    error?.field === field ? error.message : null;

  function handleEmail() {
    if (!email.trim()) return setError({ field: "email", message: "Enter your email." });
    setError(null);
    setStep("password");
  }

  async function handlePassword() {
    // The same password rules as Sign up (SCRUM-2).
    if (!passwordMeetsRules(password)) return setError({ field: "password", message: AUTH_MESSAGES.passwordRules });
    if (confirm !== password) return setError({ field: "confirm", message: AUTH_MESSAGES.passwordsDiffer });

    setError(null);
    setSubmitting(true);
    const result = await resetPassword(email.trim(), password);
    setSubmitting(false);

    if (result.ok) return onDone(email.trim());
    if (result.code === "ACCOUNT_NOT_FOUND") {
      setStep("email");
      return setError({ field: "email", message: "No account uses that email." });
    }
    if (result.code === "PASSWORD_INVALID") {
      return setError({ field: "password", message: AUTH_MESSAGES.passwordRules });
    }
    setError({
      field: "form",
      message: result.code === "NETWORK_ERROR" ? NETWORK_MESSAGE : "Something went wrong. Please try again.",
    });
  }

  if (step === "email") {
    return (
      <Screen title="Reset password" onSubmit={handleEmail}>
        <Intro>Enter the email you log in with.</Intro>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="xxx@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError("email")}
        />
        <Actions>
          <Button type="submit" fullWidth>
            Continue
          </Button>
          <TextLink onClick={onBack}>Back to log in</TextLink>
        </Actions>
      </Screen>
    );
  }

  return (
    <Screen title="Set a new password" onSubmit={handlePassword}>
      <Intro>For {email.trim()}</Intro>
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        placeholder="Enter new password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={submitting}
        error={fieldError("password")}
      />
      <TextField
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        placeholder="Re-enter new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        disabled={submitting}
        error={fieldError("confirm")}
      />
      <Actions>
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? "Saving…" : "Save new password"}
        </Button>
        <FormError message={fieldError("form")} />
        <TextLink
          onClick={() => {
            setError(null);
            setStep("email");
          }}
        >
          Back
        </TextLink>
      </Actions>
    </Screen>
  );
}
