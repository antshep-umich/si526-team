import { randomInt } from "node:crypto";

// No 0/O, 1/I/L: codes get read aloud and typed from a housemate's screen.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;

/** A random 8-character invite code (about 850 billion possibilities). */
export function newInviteCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}
