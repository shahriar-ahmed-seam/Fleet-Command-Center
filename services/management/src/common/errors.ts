import { type ErrorEnvelope, type ErrorCode, makeError } from '@fleet/contracts';

export class DomainError extends Error {
  constructor(
    public readonly envelope: ErrorEnvelope,
    public readonly httpStatus: number,
  ) {
    super(envelope.error);
    this.name = 'DomainError';
  }

  /** Convenience constructor from a code + offending fields + status. */
  static of(
    error: ErrorCode | string,
    fields: string[] = [],
    httpStatus = 400,
  ): DomainError {
    return new DomainError(makeError(error, fields), httpStatus);
  }
}
