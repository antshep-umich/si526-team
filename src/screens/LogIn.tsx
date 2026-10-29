import { useState } from "react";
import { authClient } from "../auth.ts";
import Button from "../components/Button.tsx";
import TextField from "../components/TextField.tsx";
import TextLink from "../components/TextLink.tsx";
import { AUTH_MESSAGES, describeAuthError, type Field } from "./authErrors.ts";
import Screen, { Actions, FormError, Intro } from "./Screen.tsx";

// SCRUM-3 Log in and Log out (Figma "iPhone 17 - 2"). The story logs in with a name;
// we log in with email (team decision), so its messages say "Email" instead.

type Errors = Partial<Record<Field, string>>;

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
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const found: Errors = {};
    if (!email.trim()) found.email = AUTH_MESSAGES.emailRequired;
    if (!password) found.password = AUTH_MESSAGES.passwordRequired;
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      // On success the session cookie is set and App switches to the signed-in screens.
      const { error } = await authClient.signIn.email({ email: email.trim(), password });
      if (error) {
        const { field, message } = describeAuthError(error);
        setErrors({ [field]: message });
      }
    } catch {
      setErrors({ form: AUTH_MESSAGES.serverError });
    }
    setSubmitting(false);
  }

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
        error={errors.email}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="Enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={submitting}
        error={errors.password}
      />
      <Actions>
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
        <FormError message={errors.form ?? null} />
        <TextLink onClick={onForgotPassword}>Forgot your password?</TextLink>
        {/* Not in the Figma frame: without it there's no way to reach Sign up. */}
        <TextLink onClick={onSignUp}>New here? Create an account</TextLink>
      </Actions>
    </Screen>
  );
}
