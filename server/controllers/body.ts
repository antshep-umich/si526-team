import type { Request } from "express";

/**
 * A text field from the JSON body, or "" if it's missing or not text. Services
 * then reject "" with a validation error, so routes don't repeat those checks.
 */
export function bodyText(req: Request, field: string): string {
  const value: unknown = req.body?.[field];
  return typeof value === "string" ? value : "";
}
