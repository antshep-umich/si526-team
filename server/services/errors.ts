// Errors a service throws when a request breaks one of the app's rules. Services
// don't know about HTTP: middleware/errors.ts turns each code into a status code
// and the API's JSON error format.

export type ServiceErrorCode =
  | "VALIDATION_ERROR"
  | "PASSWORD_LENGTH"
  | "FORBIDDEN"
  | "NO_HOUSEHOLD"
  | "INVITE_CODE_NOT_FOUND"
  | "ACCOUNT_NOT_FOUND"
  | "ALREADY_IN_HOUSEHOLD";

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;

  /** `message` is shown to the user as-is, so write it for them. */
  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}
