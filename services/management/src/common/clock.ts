export interface Clock {
  /** Current time in epoch milliseconds. */
  now(): number;
}

/** The default wall-clock implementation. */
export const systemClock: Clock = {
  now: () => Date.now(),
};

/** ISO-8601 string for a millisecond timestamp. */
export function toIso(ms: number): string {
  return new Date(ms).toISOString();
}
