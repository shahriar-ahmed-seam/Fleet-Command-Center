-- Migration 0001 (up): Core relational tables
--
-- Creates the relational core of Fleet Command Center: Driver, Vehicle,
-- Delivery, Assignment, and Route, together with the shared status enums,
-- unique/range constraints, foreign keys, and created/updated timestamps.
--
-- Requirements: 1.1 (driver create -> Offline), 3.1 (vehicle register),
-- 7.1 (delivery create -> Created), 8.1 (assignment links driver+vehicle),
-- 9.3 (route ordered stops). Constraints back Properties 1, 3, 4.

BEGIN;

-- PostGIS provides the geometry type used by Delivery.destination here and by
-- the geospatial tables in migration 0002.
CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- Enum domains (mirror @fleet/contracts enum string values)
-- ---------------------------------------------------------------------------
CREATE TYPE driver_status AS ENUM (
  'Offline', 'Available', 'On_Delivery', 'On_Break'
);

CREATE TYPE delivery_status AS ENUM (
  'Created', 'Assigned', 'In_Transit', 'Arrived', 'Completed', 'Failed', 'Cancelled'
);

CREATE TYPE assignment_status AS ENUM (
  'Pending', 'Accepted', 'Complete'
);

-- ---------------------------------------------------------------------------
-- Shared trigger: advance updatedAt on every UPDATE (Property 4)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW."updatedAt" := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Driver (Req 1.1): created with status Offline; unique email
-- ---------------------------------------------------------------------------
CREATE TABLE "Driver" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (length(btrim(name)) > 0),
  email         text NOT NULL,
  phone         text NOT NULL CHECK (length(btrim(phone)) > 0),
  "licenseNumber" text NOT NULL CHECK (length(btrim("licenseNumber")) > 0),
  status        driver_status NOT NULL DEFAULT 'Offline',
  active        boolean NOT NULL DEFAULT true,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Driver_email_key" UNIQUE (email)
);

CREATE TRIGGER "Driver_set_updated_at"
  BEFORE UPDATE ON "Driver"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX "Driver_status_idx" ON "Driver" (status);

-- ---------------------------------------------------------------------------
-- Vehicle (Req 3.1): unique identifier; at most one active driver association
-- ---------------------------------------------------------------------------
CREATE TABLE "Vehicle" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier    text NOT NULL CHECK (length(btrim(identifier)) > 0),
  type          text,
  "capacityKg"  numeric CHECK ("capacityKg" IS NULL OR "capacityKg" > 0),
  "driverId"    uuid REFERENCES "Driver"(id) ON DELETE SET NULL,
  "associatedAt" timestamptz,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Vehicle_identifier_key" UNIQUE (identifier)
);

-- A driver is actively associated with at most one vehicle (Req 3.3, 3.4).
CREATE UNIQUE INDEX "Vehicle_active_driver_key"
  ON "Vehicle" ("driverId")
  WHERE "driverId" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Assignment (Req 8.1): links a driver and the driver's vehicle
-- ---------------------------------------------------------------------------
CREATE TABLE "Assignment" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "driverId"    uuid NOT NULL REFERENCES "Driver"(id),
  "vehicleId"   uuid NOT NULL REFERENCES "Vehicle"(id),
  status        assignment_status NOT NULL DEFAULT 'Pending',
  "acceptedAt"  timestamptz,
  "createdAt"   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "Assignment_driverId_idx" ON "Assignment" ("driverId");
CREATE INDEX "Assignment_vehicleId_idx" ON "Assignment" ("vehicleId");
CREATE INDEX "Assignment_status_idx" ON "Assignment" (status);

-- ---------------------------------------------------------------------------
-- Delivery (Req 7.1): created with status Created; validated field lengths
-- and weight range (0, 1000]. destination geometry is added in migration 0002
-- prerequisites are not required here (column declared as PostGIS geometry).
-- ---------------------------------------------------------------------------
CREATE TABLE "Delivery" (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address         text NOT NULL CHECK (length(address) BETWEEN 1 AND 255),
  "recipientName" text NOT NULL CHECK (length("recipientName") BETWEEN 1 AND 100),
  "recipientContact" text NOT NULL CHECK (length("recipientContact") BETWEEN 1 AND 50),
  "weightKg"      numeric NOT NULL CHECK ("weightKg" > 0 AND "weightKg" <= 1000),
  destination     geometry(Point, 4326),
  status          delivery_status NOT NULL DEFAULT 'Created',
  "failureReason" text CHECK ("failureReason" IS NULL OR length("failureReason") BETWEEN 1 AND 500),
  "trackingToken" text NOT NULL,
  "assignmentId"  uuid REFERENCES "Assignment"(id) ON DELETE SET NULL,
  "completedAt"   timestamptz,
  "createdAt"     timestamptz NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Delivery_trackingToken_key" UNIQUE ("trackingToken")
);

CREATE TRIGGER "Delivery_set_updated_at"
  BEFORE UPDATE ON "Delivery"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX "Delivery_status_idx" ON "Delivery" (status);
CREATE INDEX "Delivery_assignmentId_idx" ON "Delivery" ("assignmentId");
CREATE INDEX "Delivery_recipientName_idx" ON "Delivery" ("recipientName");

-- ---------------------------------------------------------------------------
-- Route (Req 9.3): one route per assignment; ordered stops with grouped
-- co-located deliveries (deliveryIds array per stop, Req 9.8).
-- ---------------------------------------------------------------------------
CREATE TABLE "Route" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "assignmentId" uuid NOT NULL REFERENCES "Assignment"(id) ON DELETE CASCADE,
  stops         jsonb NOT NULL DEFAULT '[]'::jsonb,
  optimized     boolean NOT NULL DEFAULT false,
  "currentStop" integer NOT NULL DEFAULT 0 CHECK ("currentStop" >= 0),
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Route_assignmentId_key" UNIQUE ("assignmentId")
);

CREATE TRIGGER "Route_set_updated_at"
  BEFORE UPDATE ON "Route"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
