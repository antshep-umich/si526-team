// The account screens' messages, worded as in the stories (Jira SCRUM-2 Sign Up and
// SCRUM-3 Log In, which we log in to with email rather than name), and which field
// each of Better Auth's error codes belongs to.
import { HttpStatus } from "../../shared/httpStatus.ts";

export type Field = "name" | "email" | "password" | "confirm" | "form";

export type AuthError = { code?: string; message?: string; status?: number } | null | undefined;

export const AUTH_MESSAGES = {
  nameRequired: "Name is required.",
  nameTooLong: "Name must be 30 characters or fewer.",
  emailRequired: "Email is required.",
  emailInvalid: "Enter a valid email address.",
  emailTaken: "An account with this email already exists. Use a different email or Log in instead.",
  passwordRequired: "Password is required.",
  passwordRules: "Password must be at least 8 characters long and include 1 number.",
  passwordTooLong: "That password is too long.",
  passwordsDiffer: "Passwords do not match.",
  wrongLogIn: "Email or password is incorrect.",
  tooManyTries: "Too many tries. Wait a moment, then try again.",
  serverError: "Something went wrong. Please try again.",
} as const;

/** Only for the stand-in Forgot password screen; the stories call every failure a server error. */
export const NETWORK_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

/** A quick shape check (something@something.something); the server has the final say. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function describeAuthError(error: AuthError): { field: Field; message: string } {
  const code = error?.code ?? "";
  if (code.startsWith("USER_ALREADY_EXISTS")) return { field: "email", message: AUTH_MESSAGES.emailTaken };
  if (code === "INVALID_EMAIL") return { field: "email", message: AUTH_MESSAGES.emailInvalid };
  // SCRUM-3: doesn't say which one was wrong, for security.
  if (code === "INVALID_EMAIL_OR_PASSWORD") return { field: "form", message: AUTH_MESSAGES.wrongLogIn };
  // NAME_INVALID and PASSWORD_INVALID come from our sign-up hook (server/auth.ts).
  if (code === "NAME_INVALID") return { field: "name", message: AUTH_MESSAGES.nameTooLong };
  if (code === "PASSWORD_INVALID" || code === "PASSWORD_TOO_SHORT") {
    return { field: "password", message: AUTH_MESSAGES.passwordRules };
  }
  if (code === "PASSWORD_TOO_LONG") return { field: "password", message: AUTH_MESSAGES.passwordTooLong };
  if (error?.status === HttpStatus.TOO_MANY_REQUESTS) return { field: "form", message: AUTH_MESSAGES.tooManyTries };
  return { field: "form", message: AUTH_MESSAGES.serverError };
}
