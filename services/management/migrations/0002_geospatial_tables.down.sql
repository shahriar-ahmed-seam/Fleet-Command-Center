-- Migration 0002 (down): drop geospatial tables
--
-- Reverses 0002_geospatial_tables.up.sql.

BEGIN;

DROP TABLE IF EXISTS "Vehicle_Zone_Membership" CASCADE;
DROP TABLE IF EXISTS "Zone_Event" CASCADE;
DROP TABLE IF EXISTS "Location_Ping" CASCADE;
DROP TABLE IF EXISTS "Zone" CASCADE;

DROP TYPE IF EXISTS zone_event_type;

COMMIT;
