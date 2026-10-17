import { useState } from "react";
import { authClient } from "../auth.ts";
import Button from "../components/Button.tsx";
import TextField from "../components/TextField.tsx";
import TextLink from "../components/TextLink.tsx";
import { describeAuthError, MIN_PASSWORD, NETWORK_MESSAGE, type Field } from "./authErrors.ts";
import Screen, { Actions, FormError } from "./Screen.tsx";

// SCRUM-2 Sign Up (Figma "iPhone 17 - 1").

export default function SignUp({ onLogIn }: { onLogIn: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<{ field: Field; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    // Catch obvious mistakes before calling the server
    if (!name.trim()) return setError({ field: "name", message: "Enter your name." });
    if (!email.trim()) return setError({ field: "email", message: "Enter your email." });
    if (password.length < MIN_PASSWORD) {
      return setError({ field: "password", message: `Use at least ${MIN_PASSWORD} characters.` });
    }
    if (confirm !== password) return setError({ field: "confirm", message: "The passwords don't match." });

    setError(null);
    setSubmitting(true);
    try {
      // On success the session cookie is set and App switches to the signed-in screens.
      const { error } = await authClient.signUp.email({ name: name.trim(), email: email.trim(), password });
      if (error) setError(describeAuthError(error));
    } catch {
      setError({ field: "form", message: NETWORK_MESSAGE });
    }
    setSubmitting(false);
  }

  const fieldError = (field: Field) => (error?.field === field ? error.message : null);

  return (
    <Screen title="Create Account" onSubmit={handleSubmit}>
      <TextField
        label="Name"
        autoComplete="name"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={submitting}
        error={fieldError("name")}
      />
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
        autoComplete="new-password"
        placeholder="Enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={submitting}
        error={fieldError("password")}
      />
      <TextField
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        placeholder="Re-enter password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        disabled={submitting}
        error={fieldError("confirm")}
      />
      <Actions>
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
        <FormError message={fieldError("form")} />
        <TextLink onClick={onLogIn}>Already have an account? Log in</TextLink>
      </Actions>
    </Screen>
  );
}
