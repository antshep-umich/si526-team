export type PasswordResetResult = { ok: true } | { ok: false; code: string };

/**
 * POST /api/password-reset: the stand-in "Forgot your password?" (see
 * server/routes/passwordReset.ts). Never throws, like the other API helpers.
 */
export async function resetPassword(email: string, newPassword: string): Promise<PasswordResetResult> {
  try {
    const res = await fetch("/api/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, newPassword }),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    return { ok: false, code: body?.error?.code ?? `HTTP_${res.status}` };
  } catch {
    return { ok: false, code: "NETWORK_ERROR" };
  }
}
