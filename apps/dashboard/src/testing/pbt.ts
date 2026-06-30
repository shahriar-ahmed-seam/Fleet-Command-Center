import type { Parameters as FcParameters } from 'fast-check';

/** Project-wide minimum number of iterations every property test must run. */
export const MIN_ITERATIONS = 100;

/** Feature tag prefix applied to every property test. */
export const FEATURE = 'fleet-command-center';

/**
 * Default fast-check parameters with the min-100-iteration default applied.
 */
export function pbtParams<Ts = unknown>(
  overrides: FcParameters<Ts> = {},
): FcParameters<Ts> {
  return { numRuns: MIN_ITERATIONS, ...overrides };
}


export function tag(n: number, text: string): string {
  return `Feature: ${FEATURE}, Property ${n}: ${text}`;
}
