/** An exterior ring: `[lng, lat]` positions, expected closed (first == last). */
export type Ring = ReadonlyArray<readonly [number, number]>;

/** The two PostGIS predicates the zone service consults. */
export interface GeometryCheck {
  /** ST_IsClosed: the ring's first and last positions coincide. */
  isClosed: boolean;
  /** ST_IsValid: the ring forms a simple (non-self-intersecting) polygon. */
  isValid: boolean;
}

export interface ZoneGeometryValidator {
  /** Evaluate ST_IsClosed / ST_IsValid for the given exterior ring. */
  check(ring: Ring): Promise<GeometryCheck>;
}

function pointsEqual(a: readonly [number, number], b: readonly [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** Orientation of the ordered triplet (p, q, r): 0 collinear, 1 cw, 2 ccw. */
function orientation(
  p: readonly [number, number],
  q: readonly [number, number],
  r: readonly [number, number],
): number {
  const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  if (val === 0) return 0;
  return val > 0 ? 1 : 2;
}

function onSegment(
  p: readonly [number, number],
  q: readonly [number, number],
  r: readonly [number, number],
): boolean {
  return (
    Math.min(p[0], r[0]) <= q[0] &&
    q[0] <= Math.max(p[0], r[0]) &&
    Math.min(p[1], r[1]) <= q[1] &&
    q[1] <= Math.max(p[1], r[1])
  );
}

/** Whether closed segments p1p2 and p3p4 intersect (including touching). */
function segmentsIntersect(
  p1: readonly [number, number],
  p2: readonly [number, number],
  p3: readonly [number, number],
  p4: readonly [number, number],
): boolean {
  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p3, p2)) return true;
  if (o2 === 0 && onSegment(p1, p4, p2)) return true;
  if (o3 === 0 && onSegment(p3, p1, p4)) return true;
  if (o4 === 0 && onSegment(p3, p2, p4)) return true;
  return false;
}

/**
 * Pure-JS {@link ZoneGeometryValidator} mirroring PostGIS semantics, used for
 * unit tests and local runs. `isClosed` checks the ring endpoints coincide;
 * `isValid` checks the ring is a simple polygon — no two boundary edges cross,
 * and only consecutive edges may meet (at their shared vertex).
 */
export class PurePolygonValidator implements ZoneGeometryValidator {
  check(ring: Ring): Promise<GeometryCheck> {
    return Promise.resolve(this.checkSync(ring));
  }

  checkSync(ring: Ring): GeometryCheck {
    const isClosed =
      ring.length >= 4 && pointsEqual(ring[0], ring[ring.length - 1]);
    return { isClosed, isValid: this.isSimplePolygon(ring, isClosed) };
  }

  private isSimplePolygon(ring: Ring, isClosed: boolean): boolean {
    if (!isClosed) return false;
    // Distinct boundary vertices (drop the duplicated closing position).
    const pts = ring.slice(0, ring.length - 1);
    const n = pts.length;
    if (n < 3) return false;

    // Edge i connects pts[i] -> pts[(i+1) % n]. Two edges may intersect only if
    // they are the same edge or adjacent (sharing exactly one endpoint).
    for (let i = 0; i < n; i += 1) {
      const a1 = pts[i];
      const a2 = pts[(i + 1) % n];
      for (let j = i + 1; j < n; j += 1) {
        const b1 = pts[j];
        const b2 = pts[(j + 1) % n];
        const adjacent =
          j === i + 1 || (i === 0 && j === n - 1); // share a vertex
        if (adjacent) {
          // Adjacent edges are allowed to touch at their shared endpoint only;
          // a collinear overlap (zero-length / spike) is invalid.
          if (this.collinearOverlap(a1, a2, b1, b2)) return false;
          continue;
        }
        if (segmentsIntersect(a1, a2, b1, b2)) return false;
      }
    }
    return true;
  }

  /** Detect a degenerate collinear overlap between adjacent edges. */
  private collinearOverlap(
    a1: readonly [number, number],
    a2: readonly [number, number],
    b1: readonly [number, number],
    b2: readonly [number, number],
  ): boolean {
    if (
      orientation(a1, a2, b1) === 0 &&
      orientation(a1, a2, b2) === 0
    ) {
      // All four points collinear: an overlap beyond the shared endpoint is a
      // spike/zero-area degeneracy.
      const sharedAtEnd = pointsEqual(a2, b1);
      const sharedAtStart = pointsEqual(a1, b2);
      if (sharedAtEnd && onSegment(a1, b2, a2)) return true;
      if (sharedAtStart && onSegment(b1, a2, b2)) return true;
    }
    return false;
  }
}

/**
 * Build a PostGIS WKT `POLYGON` / `LINESTRING` literal from an exterior ring.
 * Exposed for the PostGIS-backed validator and for DB verification.
 */
export function ringToLineStringWkt(ring: Ring): string {
  const coords = ring.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
  return `LINESTRING(${coords})`;
}

export function ringToPolygonWkt(ring: Ring): string {
  const coords = ring.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
  return `POLYGON((${coords}))`;
}

/** Count of distinct boundary vertices for a (closed) ring. */
export function distinctVertexCount(ring: Ring): number {
  if (ring.length >= 2 && pointsEqual(ring[0], ring[ring.length - 1])) {
    return ring.length - 1;
  }
  return ring.length;
}
