import { getAuth } from "../auth.js";
import { ServiceError } from "./errors.js";

// STAND-IN for "Forgot your password?" until the app can send email (TECH_SPEC
// section 8). Anyone who knows an account's email can set a new password for it,
// so this is only acceptable while the users are the team and research
// participants. See TECH_DEBT.md #7 before sharing the app more widely.

/** Sets a new password for the account with this email, and signs it out everywhere. */
export async function resetPassword(email: string, newPassword: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new ServiceError("VALIDATION_ERROR", "Enter your email");

  // Same hashing, length rules and storage as Better Auth's own sign-up.
  const ctx = await getAuth().$context;
  const { minPasswordLength, maxPasswordLength } = ctx.password.config;
  if (newPassword.length < minPasswordLength || newPassword.length > maxPasswordLength) {
    throw new ServiceError(
      "PASSWORD_LENGTH",
      `Passwords need ${minPasswordLength} to ${maxPasswordLength} characters`,
    );
  }

  const found = await ctx.internalAdapter.findUserByEmail(cleanEmail);
  const account = found && (await ctx.internalAdapter.findCredentialAccount(found.user.id));
  if (!found || !account) throw new ServiceError("ACCOUNT_NOT_FOUND", "No account uses that email");

  await ctx.internalAdapter.updatePassword(found.user.id, await ctx.password.hash(newPassword));
  await ctx.internalAdapter.deleteUserSessions(found.user.id);
}
