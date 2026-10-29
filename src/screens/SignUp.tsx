import { useState } from "react";
import { passwordMeetsRules, USER_NAME_MAX_LENGTH } from "../../shared/accounts.ts";
import { authClient } from "../auth.ts";
import Button from "../components/Button.tsx";
import TextField from "../components/TextField.tsx";
import TextLink from "../components/TextLink.tsx";
import { AUTH_MESSAGES, describeAuthError, looksLikeEmail, type Field } from "./authErrors.ts";
import Screen, { Actions, FormError } from "./Screen.tsx";

// SCRUM-2 Sign Up (Figma "iPhone 17 - 1").

type Errors = Partial<Record<Field, string>>;

/** Every problem at once (SCRUM-2), checked before anything is sent. */
function validate(name: string, email: string, password: string, confirm: string): Errors {
  const errors: Errors = {};
  if (!name.trim()) errors.name = AUTH_MESSAGES.nameRequired;
  else if (name.trim().length > USER_NAME_MAX_LENGTH) errors.name = AUTH_MESSAGES.nameTooLong;
  if (!email.trim()) errors.email = AUTH_MESSAGES.emailRequired;
  else if (!looksLikeEmail(email)) errors.email = AUTH_MESSAGES.emailInvalid;
  if (!password) errors.password = AUTH_MESSAGES.passwordRequired;
  else if (!passwordMeetsRules(password)) errors.password = AUTH_MESSAGES.passwordRules;
  if (confirm !== password) errors.confirm = AUTH_MESSAGES.passwordsDiffer;
  return errors;
}

export default function SignUp({ onLogIn }: { onLogIn: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  // SCRUM-2: after any invalid field, Name and Email keep their values and both
  // password fields are cleared.
  function showFieldErrors(found: Errors) {
    setErrors(found);
    setPassword("");
    setConfirm("");
  }

  async function handleSubmit() {
    const found = validate(name, email, password, confirm);
    if (Object.keys(found).length > 0) return showFieldErrors(found);

    setErrors({});
    setSubmitting(true);
    try {
      // On success the session cookie is set and App switches to the signed-in screens.
      const { error } = await authClient.signUp.email({ name: name.trim(), email: email.trim(), password });
      if (error) {
        const { field, message } = describeAuthError(error);
        if (field === "form") setErrors({ form: message });
        else showFieldErrors({ [field]: message });
      }
    } catch {
      setErrors({ form: AUTH_MESSAGES.serverError });
    }
    setSubmitting(false);
  }

  return (
    <Screen title="Create Account" onSubmit={handleSubmit}>
      {/* SCRUM-2: a server error shows as a banner above the form. */}
      <FormError message={errors.form ?? null} />
      <TextField
        label="Name"
        autoComplete="name"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={submitting}
        error={errors.name}
      />
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
        autoComplete="new-password"
        placeholder="Enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={submitting}
        error={errors.password}
      />
      <TextField
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        placeholder="Re-enter password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        disabled={submitting}
        error={errors.confirm}
      />
      <Actions>
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
        <TextLink onClick={onLogIn}>Already have an account? Log in</TextLink>
      </Actions>
    </Screen>
  );
}
