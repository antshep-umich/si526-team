// Turns Better Auth's error codes into our wording, and says which field it belongs to.

export type Field = "name" | "email" | "password" | "confirm" | "form";

export type AuthError = { code?: string; message?: string; status?: number } | null | undefined;

export const MIN_PASSWORD = 8; // Better Auth's default minimum

export const NETWORK_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

export function describeAuthError(error: AuthError): { field: Field; message: string } {
  const code = error?.code ?? "";
  if (code.startsWith("USER_ALREADY_EXISTS")) {
    return { field: "email", message: "An account already uses this email. Log in instead." };
  }
  if (code === "INVALID_EMAIL") return { field: "email", message: "Enter a valid email address." };
  if (code === "INVALID_EMAIL_OR_PASSWORD") {
    return { field: "password", message: "That email and password don't match." };
  }
  if (code === "PASSWORD_TOO_SHORT") {
    return { field: "password", message: `Use at least ${MIN_PASSWORD} characters.` };
  }
  if (code === "PASSWORD_TOO_LONG") return { field: "password", message: "That password is too long." };
  if (error?.status === 429) {
    return { field: "form", message: "Too many tries. Wait a moment, then try again." };
  }
  if (!error?.status) return { field: "form", message: NETWORK_MESSAGE };
  return { field: "form", message: error.message ?? "Something went wrong. Please try again." };
}
