/**
 * The HTTP status codes the API uses (RFC 9110), by name, so code reads
 * `HttpStatus.CREATED` instead of 201. TECH_SPEC section 6 says which endpoint
 * answers with which.
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,

  /** The request itself is malformed, such as invalid JSON. */
  BAD_REQUEST: 400,
  /** Nobody is signed in. */
  UNAUTHORIZED: 401,
  /** Signed in, but not allowed to do this. */
  FORBIDDEN: 403,
  /** The URL names something that doesn't exist. */
  NOT_FOUND: 404,
  /** The URL exists, but not with this method; the Allow header lists the methods it takes. */
  METHOD_NOT_ALLOWED: 405,
  /** The request clashes with the current state, such as joining a second household. */
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  /** The body isn't JSON. */
  UNSUPPORTED_MEDIA_TYPE: 415,
  /** Well-formed JSON whose values break a rule, such as a blank name or an unknown invite code. */
  UNPROCESSABLE_CONTENT: 422,
  TOO_MANY_REQUESTS: 429,

  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatus = (typeof HttpStatus)[keyof typeof HttpStatus];
