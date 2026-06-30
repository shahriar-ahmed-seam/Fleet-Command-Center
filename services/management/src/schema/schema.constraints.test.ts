import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CONTAINER = 'fcc-postgis';
const PG_USER = 'fleet';
const ADMIN_DB = 'fleet_command_center';
const TEST_DB = 'fcc_schema_test';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');
const MIGRATIONS = [
  '0001_core_relational_tables.up.sql',
  '0002_geospatial_tables.up.sql',
  '0003_delivery_status_history_retention.up.sql',
];

interface PsqlResult {
  status: number;
  stdout: string;
  stderr: string;
}

/** Run SQL (piped on stdin) against `db` inside the postgis container. */
function psql(db: string, sql: string, tuplesOnly = false): PsqlResult {
  const args = [
    'exec',
    '-i',
    CONTAINER,
    'psql',
    '-q',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    PG_USER,
    '-d',
    db,
  ];
  if (tuplesOnly) args.push('-tA');
  try {
    const stdout = execFileSync('docker', args, {
      input: sql,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return {
      status: e.status ?? 1,
      stdout: e.stdout?.toString() ?? '',
      stderr: e.stderr?.toString() ?? '',
    };
  }
}

/** Assert a SQL statement succeeds. */
function expectOk(db: string, sql: string): void {
  const r = psql(db, sql);
  if (r.status !== 0) {
    throw new Error(`expected SQL to succeed but it failed:\n${sql}\n${r.stderr}`);
  }
}

/** Assert a SQL statement is rejected (non-zero exit under ON_ERROR_STOP). */
function expectReject(db: string, sql: string): PsqlResult {
  const r = psql(db, sql);
  expect(r.status).not.toBe(0);
  return r;
}

/** Single scalar result of a query (first non-empty output line). */
function scalar(db: string, sql: string): string {
  const r = psql(db, sql, true);
  if (r.status !== 0) {
    throw new Error(`query failed:\n${sql}\n${r.stderr}`);
  }
  const firstLine = r.stdout
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return firstLine ?? '';
}

beforeAll(() => {
  // Verify the container is reachable; fail clearly if not.
  const ping = psql(ADMIN_DB, 'SELECT 1;');
  if (ping.status !== 0) {
    throw new Error(
      `cannot reach ${CONTAINER}; run "docker compose up -d postgis".\n${ping.stderr}`,
    );
  }

  // Fresh, isolated test database (DROP/CREATE must run outside the target DB).
  expectOk(ADMIN_DB, `DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE);`);
  expectOk(ADMIN_DB, `CREATE DATABASE ${TEST_DB};`);

  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const r = psql(TEST_DB, sql);
    if (r.status !== 0) {
      throw new Error(`migration ${file} failed:\n${r.stderr}`);
    }
  }
}, 120_000);

afterAll(() => {
  psql(ADMIN_DB, `DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE);`);
});

describe('schema constraints (task 2.4)', () => {
  describe('unique constraints reject duplicates', () => {
    it('rejects a duplicate Driver email', () => {
      expectOk(
        TEST_DB,
        `INSERT INTO "Driver" (name, email, phone, "licenseNumber")
         VALUES ('Ann', 'dup@example.com', '555-0001', 'LIC-1');`,
      );
      const r = expectReject(
        TEST_DB,
        `INSERT INTO "Driver" (name, email, phone, "licenseNumber")
         VALUES ('Bob', 'dup@example.com', '555-0002', 'LIC-2');`,
      );
      expect(r.stderr).toMatch(/Driver_email_key|duplicate key/i);
    });

    it('rejects a duplicate Vehicle identifier', () => {
      expectOk(
        TEST_DB,
        `INSERT INTO "Vehicle" (identifier, type) VALUES ('VAN-1', 'van');`,
      );
      const r = expectReject(
        TEST_DB,
        `INSERT INTO "Vehicle" (identifier, type) VALUES ('VAN-1', 'truck');`,
      );
      expect(r.stderr).toMatch(/Vehicle_identifier_key|duplicate key/i);
    });

    it('allows at most one active driver association per driver', () => {
      const driverId = scalar(
        TEST_DB,
        `INSERT INTO "Driver" (name, email, phone, "licenseNumber")
         VALUES ('Cara', 'cara@example.com', '555-0003', 'LIC-3') RETURNING id;`,
      );
      expectOk(
        TEST_DB,
        `INSERT INTO "Vehicle" (identifier, "driverId") VALUES ('ASSOC-A', '${driverId}');`,
      );
      const r = expectReject(
        TEST_DB,
        `INSERT INTO "Vehicle" (identifier, "driverId") VALUES ('ASSOC-B', '${driverId}');`,
      );
      expect(r.stderr).toMatch(/Vehicle_active_driver_key|duplicate key/i);
    });

    it('rejects a duplicate Delivery trackingToken', () => {
      expectOk(
        TEST_DB,
        `INSERT INTO "Delivery" (address, "recipientName", "recipientContact", "weightKg", "trackingToken")
         VALUES ('1 Main St', 'Rae', '555-1', 10, 'TOK-DUP');`,
      );
      const r = expectReject(
        TEST_DB,
        `INSERT INTO "Delivery" (address, "recipientName", "recipientContact", "weightKg", "trackingToken")
         VALUES ('2 Main St', 'Sam', '555-2', 20, 'TOK-DUP');`,
      );
      expect(r.stderr).toMatch(/Delivery_trackingToken_key|duplicate key/i);
    });
  });

  describe('enum guards reject out-of-domain values', () => {
    it('defines driver_status with exactly the contract labels', () => {
      const labels = scalar(
        TEST_DB,
        `SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
           FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'driver_status';`,
      );
      expect(labels).toBe('Offline,Available,On_Delivery,On_Break');
    });

    it('rejects an invalid Driver status value', () => {
      const r = expectReject(
        TEST_DB,
        `INSERT INTO "Driver" (name, email, phone, "licenseNumber", status)
         VALUES ('Eve', 'eve@example.com', '555-0004', 'LIC-4', 'Bogus');`,
      );
      expect(r.stderr).toMatch(/invalid input value for enum driver_status/i);
    });

    it('rejects an invalid Delivery status value', () => {
      const r = expectReject(
        TEST_DB,
        `INSERT INTO "Delivery" (address, "recipientName", "recipientContact", "weightKg", "trackingToken", status)
         VALUES ('3 Main St', 'Tom', '555-3', 30, 'TOK-ENUM', 'Nope');`,
      );
      expect(r.stderr).toMatch(/invalid input value for enum delivery_status/i);
    });
  });

  describe('spatial indexes are present with the expected access method', () => {
    function indexAccessMethod(indexName: string): string {
      return scalar(
        TEST_DB,
        `SELECT am.amname
           FROM pg_class i
           JOIN pg_am am ON am.oid = i.relam
          WHERE i.relname = '${indexName}';`,
      );
    }

    it('Zone.geom has a GiST index', () => {
      expect(indexAccessMethod('Zone_geom_gist')).toBe('gist');
    });

    it('Location_Ping.geom has a GiST index', () => {
      expect(indexAccessMethod('Location_Ping_geom_gist')).toBe('gist');
    });

    it('Location_Ping has a btree index on (vehicleId, timestamp)', () => {
      expect(indexAccessMethod('Location_Ping_vehicle_ts_idx')).toBe('btree');
      const cols = scalar(
        TEST_DB,
        `SELECT pg_get_indexdef(i.oid)
           FROM pg_class i WHERE i.relname = 'Location_Ping_vehicle_ts_idx';`,
      );
      expect(cols).toMatch(/"vehicleId"/);
      expect(cols).toMatch(/"timestamp"/);
    });
  });
});
