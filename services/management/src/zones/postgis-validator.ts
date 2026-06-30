import {
  type GeometryCheck,
  type Ring,
  type ZoneGeometryValidator,
  ringToLineStringWkt,
  ringToPolygonWkt,
} from './geometry';

/** Runs a query expected to yield one row; returns that row's columns. */
export type SqlScalarRunner = (sql: string) => Promise<string[]>;

const SRID = 4326;

export class PostgisGeometryValidator implements ZoneGeometryValidator {
  constructor(private readonly run: SqlScalarRunner) {}

  async check(ring: Ring): Promise<GeometryCheck> {
    const line = `ST_GeomFromText('${ringToLineStringWkt(ring)}', ${SRID})`;
    const [closedStr] = await this.run(`SELECT ST_IsClosed(${line});`);
    const isClosed = parseBool(closedStr);

    let isValid: boolean;
    if (isClosed) {
      const polygon = `ST_GeomFromText('${ringToPolygonWkt(ring)}', ${SRID})`;
      const [validStr] = await this.run(`SELECT ST_IsValid(${polygon});`);
      isValid = parseBool(validStr);
    } else {
      // An unclosed ring can never form a valid polygon (matches the pure
      // validator); no further query is needed.
      isValid = false;
    }
    return { isClosed, isValid };
  }
}

function parseBool(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 't' || value?.trim().toLowerCase() === 'true';
}
