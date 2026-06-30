/** A geocoded coordinate (WGS84 degrees). */
export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Geocoder {
  
  geocode(address: string): Promise<GeoPoint>;
}

/**
 * Race a promise against a timeout. If `promise` does not settle within
 * `timeoutMs`, the returned promise rejects with {@link TimeoutError}. The
 * timer is always cleared so it never keeps the event loop alive.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Raised by {@link withTimeout} when the wrapped promise exceeds the budget. */
export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`operation timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}
