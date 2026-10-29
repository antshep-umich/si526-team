// Account rules from Jira SCRUM-2 (Sign Up), shared by the sign-up screen and the
// server (Better Auth's sign-up hook in server/auth.ts).

export const USER_NAME_MAX_LENGTH = 30;
export const PASSWORD_MIN_LENGTH = 8;

/** At least 8 characters and at least 1 number. */
export function passwordMeetsRules(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && /\d/.test(password);
}

/** 1 to 30 characters once trimmed. */
export function userNameMeetsRules(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= USER_NAME_MAX_LENGTH;
}
