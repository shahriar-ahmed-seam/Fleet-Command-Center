-- Migration 0002 (up): Geospatial tables and spatial indexes
--
-- Adds the geo-fencing and telemetry schema: Zone (Polygon 4326 + GiST),
-- Location_Ping (Point 4326 + GiST + btree (vehicleId, timestamp)),
-- Zone_Event, and the Vehicle_Zone_Membership working-state table.
--
-- Requirements: 4.1 (persist pings with vehicle/driver + telemetry),
-- 6.1 (persist valid zone geometry), 6.3/6.4 (Enter/Exit membership eval).
-- Backs Properties 11, 12, 16, 17, 18.

BEGIN;

-- PostGIS is enabled in migration 0001; this guard keeps 0002 self-contained.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Zone-event direction enum (mirrors @fleet/contracts ZoneEventType).
CREATE TYPE zone_event_type AS ENUM ('Enter', 'Exit');

-- ---------------------------------------------------------------------------
-- Zone (Req 6.1): named geographic polygon used for geo-fencing.
-- Geometry validity (closed, simple, vertex bounds) is enforced by the
-- service layer via ST_IsValid/ST_IsClosed before insert (Req 6.2); a CHECK
-- backstops basic validity and SRID at the database level.
-- ---------------------------------------------------------------------------
CREATE TABLE "Zone" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  geom          geometry(Polygon, 4326) NOT NULL,
  "arrivalLabel" text CHECK ("arrivalLabel" IS NULL OR length("arrivalLabel") BETWEEN 1 AND 100),
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Zone_geom_valid" CHECK (ST_IsValid(geom))
);

-- GiST spatial index for containment queries (ST_Contains / ST_DWithin).
CREATE INDEX "Zone_geom_gist" ON "Zone" USING gist (geom);

-- ---------------------------------------------------------------------------
-- Location_Ping (Req 4.1): timestamped vehicle position + optional telemetry.
-- ---------------------------------------------------------------------------
CREATE TABLE "Location_Ping" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "vehicleId"   uuid NOT NULL REFERENCES "Vehicle"(id) ON DELETE CASCADE,
  "driverId"    uuid REFERENCES "Driver"(id) ON DELETE SET NULL,
  geom          geometry(Point, 4326) NOT NULL,
  "timestamp"   timestamptz NOT NULL,
  "receivedAt"  timestamptz NOT NULL DEFAULT now(),
  speed         numeric,
  heading       numeric,
  battery       numeric
);

-- GiST spatial index on position for spatial queries.
CREATE INDEX "Location_Ping_geom_gist" ON "Location_Ping" USING gist (geom);

-- btree on (vehicleId, timestamp) for per-vehicle ordering / track queries
-- (high-water-mark lookups Req 4.4, historical track Req 16.3).
CREATE INDEX "Location_Ping_vehicle_ts_idx"
  ON "Location_Ping" ("vehicleId", "timestamp");

-- ---------------------------------------------------------------------------
-- Zone_Event (Req 6.3/6.4): Enter/Exit events with retry bookkeeping.
-- ---------------------------------------------------------------------------
CREATE TABLE "Zone_Event" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "vehicleId"   uuid NOT NULL REFERENCES "Vehicle"(id) ON DELETE CASCADE,
  "zoneId"      uuid NOT NULL REFERENCES "Zone"(id) ON DELETE CASCADE,
  type          zone_event_type NOT NULL,
  label         text,
  "occurredAt"  timestamptz NOT NULL DEFAULT now(),
  "deliveredAt" timestamptz,
  "deliveryAttempts" integer NOT NULL DEFAULT 0 CHECK ("deliveryAttempts" >= 0)
);

CREATE INDEX "Zone_Event_vehicle_idx" ON "Zone_Event" ("vehicleId");
CREATE INDEX "Zone_Event_zone_idx" ON "Zone_Event" ("zoneId");
CREATE INDEX "Zone_Event_occurredAt_idx" ON "Zone_Event" ("occurredAt");

-- ---------------------------------------------------------------------------
-- Vehicle_Zone_Membership (working state): prior membership the
-- Geofence_Engine compares against to decide Enter/Exit/no-event (Req 6.5).
-- ---------------------------------------------------------------------------
CREATE TABLE "Vehicle_Zone_Membership" (
  "vehicleId"   uuid NOT NULL REFERENCES "Vehicle"(id) ON DELETE CASCADE,
  "zoneId"      uuid NOT NULL REFERENCES "Zone"(id) ON DELETE CASCADE,
  inside        boolean NOT NULL DEFAULT false,
  "updatedAt"   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("vehicleId", "zoneId")
);

COMMIT;
