import { useState, type FormEvent } from "react";
import { authClient } from "./auth.ts";

// Spike 2 sign-in screen: plain on purpose, until UX designs the real one.

const MIN_PASSWORD = 8; // Better Auth's default minimum
const FALLBACK_ERROR = "Something went wrong. Please try again.";

export default function SignIn() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const signingUp = mode === "sign-up";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); // stop the browser reloading the page

    // Catch obvious mistakes before calling the server
    if (signingUp && name.trim().length === 0) return setError("Please enter your name.");
    if (email.trim().length === 0) return setError("Please enter your email.");
    if (signingUp && password.length < MIN_PASSWORD) {
      return setError(`Passwords need at least ${MIN_PASSWORD} characters.`);
    }

    setError(null);
    setSubmitting(true);
    try {
      // On success Better Auth sets the session cookie, and useSession in App re-renders.
      const { error } = signingUp
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
      if (error) setError(error.message ?? FALLBACK_ERROR);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
    setSubmitting(false); // the form stays usable after any outcome
  }

  function switchMode() {
    setMode(signingUp ? "sign-in" : "sign-up");
    setError(null);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2>{signingUp ? "Create an account" : "Sign in"}</h2>
      {signingUp && (
        <p>
          <label htmlFor="sign-in-name">Name</label>{" "}
          <input
            id="sign-in-name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
        </p>
      )}
      <p>
        <label htmlFor="sign-in-email">Email</label>{" "}
        <input
          id="sign-in-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
        />
      </p>
      <p>
        <label htmlFor="sign-in-password">Password</label>{" "}
        <input
          id="sign-in-password"
          type="password"
          autoComplete={signingUp ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
        />
        {signingUp && <small> At least {MIN_PASSWORD} characters</small>}
      </p>
      <button type="submit" disabled={submitting}>
        {submitting ? "Please wait…" : signingUp ? "Create account" : "Sign in"}
      </button>{" "}
      <button type="button" onClick={switchMode} disabled={submitting}>
        {signingUp ? "I already have an account" : "Create an account instead"}
      </button>
      <p role="alert">{error}</p>
    </form>
  );
}
