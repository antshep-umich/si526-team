// Invite links: <site>/join/<invite code> (design note 2026-11-15, "Invite links").
// There's no router: the app reads this one address when it opens, keeps the code for the
// browser tab's session (so it survives Log in or Sign up) and puts "/" back in the address bar.

const KEY = "jaals.inviteCode";
const JOIN_PATH = /^\/join\/([^/]+)\/?$/;

/** The link the House tab shares. */
export function inviteLink(inviteCode: string, origin = window.location.origin): string {
  return `${origin}/join/${encodeURIComponent(inviteCode)}`;
}

/** Called once at startup: keeps the code from a /join/<code> address and tidies the address. */
export function takeInviteCodeFromAddress(location: Pick<Location, "pathname"> = window.location) {
  const match = JOIN_PATH.exec(location.pathname);
  if (!match) return;
  try {
    sessionStorage.setItem(KEY, decodeURIComponent(match[1]!));
  } catch {
    // Storage blocked or a malformed code: the user can still type the code in.
  }
  window.history.replaceState(null, "", "/");
}

/** The code from an invite link that hasn't been used yet, if any. */
export function pendingInviteCode(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function forgetInviteCode() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing was stored.
  }
}
