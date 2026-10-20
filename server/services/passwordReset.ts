import { deleteAllSessions, findPasswordAccountByEmail, passwordLengthLimits, setPassword } from "../models/accounts.js";
import { ServiceError } from "./errors.js";

// STAND-IN for "Forgot your password?" until the app can send email (TECH_SPEC
// section 8). Anyone who knows an account's email can set a new password for it,
// so this is only acceptable while the users are the team and research
// participants. See TECH_DEBT.md #7 before sharing the app more widely.

/** Sets a new password for the account with this email, and signs it out everywhere. */
export async function resetPassword(email: string, newPassword: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new ServiceError("VALIDATION_ERROR", "Enter your email");

  // Same length rules as sign-up.
  const { min, max } = await passwordLengthLimits();
  if (newPassword.length < min || newPassword.length > max) {
    throw new ServiceError("PASSWORD_LENGTH", `Passwords need ${min} to ${max} characters`);
  }

  const account = await findPasswordAccountByEmail(cleanEmail);
  if (!account) throw new ServiceError("ACCOUNT_NOT_FOUND", "No account uses that email");

  await setPassword(account.userId, newPassword);
  await deleteAllSessions(account.userId);
}
