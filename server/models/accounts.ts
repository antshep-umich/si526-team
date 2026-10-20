import { getAuth } from "../auth.js";

// Better Auth's tables (user, account, session). We read and write them through
// Better Auth itself, so passwords are hashed and stored exactly as sign-up does.

const context = () => getAuth().$context;

/** The password length rules Better Auth applies at sign-up. */
export async function passwordLengthLimits(): Promise<{ min: number; max: number }> {
  const { minPasswordLength, maxPasswordLength } = (await context()).password.config;
  return { min: minPasswordLength, max: maxPasswordLength };
}

/** The user with this email, if they sign in with a password (not, say, only with Google). */
export async function findPasswordAccountByEmail(email: string): Promise<{ userId: string } | null> {
  const ctx = await context();
  const found = await ctx.internalAdapter.findUserByEmail(email);
  if (!found) return null;
  const account = await ctx.internalAdapter.findCredentialAccount(found.user.id);
  return account ? { userId: found.user.id } : null;
}

/** Hashes and stores a new password for the user. */
export async function setPassword(userId: string, newPassword: string): Promise<void> {
  const ctx = await context();
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(newPassword));
}

/** Ends every session the user has, on every device. */
export async function deleteAllSessions(userId: string): Promise<void> {
  await (await context()).internalAdapter.deleteUserSessions(userId);
}
