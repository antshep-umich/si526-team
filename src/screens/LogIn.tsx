import { useState } from "react";
import { authClient } from "../auth.ts";
import Button from "../components/Button.tsx";
import TextField from "../components/TextField.tsx";
import TextLink from "../components/TextLink.tsx";
import { describeAuthError, NETWORK_MESSAGE, type Field } from "./authErrors.ts";
import Screen, { Actions, FormError, Intro } from "./Screen.tsx";

// SCRUM-3 Log in and Log out (Figma "iPhone 17 - 2").

type LogInProps = {
  initialEmail?: string;
  /** Shown under the title, for example after a password reset. */
  notice?: string | null;
  onSignUp: () => void;
  onForgotPassword: () => void;
};

export default function LogIn({ initialEmail = "", notice, onSignUp, onForgotPassword }: LogInProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ field: Field; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) return setError({ field: "email", message: "Enter your email." });
    if (!password) return setError({ field: "password", message: "Enter your password." });

    setError(null);
    setSubmitting(true);
    try {
      // On success the session cookie is set and App switches to the signed-in screens.
      const { error } = await authClient.signIn.email({ email: email.trim(), password });
      if (error) setError(describeAuthError(error));
    } catch {
      setError({ field: "form", message: NETWORK_MESSAGE });
    }
    setSubmitting(false);
  }

  const fieldError = (field: Field) => (error?.field === field ? error.message : null);

  return (
    <Screen title="Log in" onSubmit={handleSubmit}>
      {notice && <Intro>{notice}</Intro>}
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="xxx@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={submitting}
        error={fieldError("email")}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="Enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={submitting}
        error={fieldError("password")}
      />
      <Actions>
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
        <FormError message={fieldError("form")} />
        <TextLink onClick={onForgotPassword}>Forgot your password?</TextLink>
        {/* Not in the Figma frame: without it there's no way to reach Sign up. */}
        <TextLink onClick={onSignUp}>New here? Create an account</TextLink>
      </Actions>
    </Screen>
  );
}
