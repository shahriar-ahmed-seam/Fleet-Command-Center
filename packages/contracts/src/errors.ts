/**
 * Stable error codes used in the `error` discriminator of {@link ErrorEnvelope}.
 */
export enum ErrorCode {
  ValidationError = 'validation-error',
  Duplicate = 'duplicate',
  Conflict = 'conflict',
  InvalidTransition = 'invalid-transition',
  UnavailableDriver = 'unavailable-driver',
  AlreadyAssigned = 'already-assigned',
  GeocodingFailure = 'geocoding-failure',
  OverLimit = 'over-limit',
  AuthenticationFailed = 'authentication-failed',
  AuthorizationDenied = 'authorization-denied',
  StalePing = 'stale-ping',
  NotFound = 'not-found',
}

/**
 * The canonical error envelope: a machine-readable `error` code plus the list
 * of offending field names. `fields` is empty for errors not tied to specific
 * input fields (e.g. authorization-denied).
 */
export interface ErrorEnvelope {
  error: ErrorCode | string;
  fields: string[];
}

/**
 * Construct an {@link ErrorEnvelope}, defaulting `fields` to an empty array.
 */
export function makeError(
  error: ErrorCode | string,
  fields: string[] = [],
): ErrorEnvelope {
  return { error, fields };
}
