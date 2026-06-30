-- Migration 0001 (down): drop core relational tables
--
-- Reverses 0001_core_relational_tables.up.sql. Tables are dropped in reverse
-- dependency order; enum types and the shared trigger function follow.

BEGIN;

DROP TABLE IF EXISTS "Route" CASCADE;
DROP TABLE IF EXISTS "Delivery" CASCADE;
DROP TABLE IF EXISTS "Assignment" CASCADE;
DROP TABLE IF EXISTS "Vehicle" CASCADE;
DROP TABLE IF EXISTS "Driver" CASCADE;

DROP TYPE IF EXISTS assignment_status;
DROP TYPE IF EXISTS delivery_status;
DROP TYPE IF EXISTS driver_status;

DROP FUNCTION IF EXISTS set_updated_at();

-- PostGIS extension is intentionally left installed; it is shared with the
-- geospatial schema (migration 0002).

COMMIT;
