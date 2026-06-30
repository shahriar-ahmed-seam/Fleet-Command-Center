-- Migration 0003 (up): Delivery status history + retention policy
--
-- Adds Delivery_Status_History (ordered status transitions with timestamps,
-- Req 16.2) and a >=365-day retention policy for completed/failed deliveries
-- (Req 16.1). Backs Property 40.
--
-- The retention policy is expressed as data (a config row) plus a guarded
-- purge function: the function only removes terminal deliveries whose terminal
-- timestamp is OLDER than the configured retention interval, so completed and
-- failed records are always retained for at least the configured window. A
-- scheduler (pg_cron, or an external job) invokes purge_expired_deliveries()
-- periodically; the >=365-day guarantee holds regardless of cadence.

BEGIN;

-- ---------------------------------------------------------------------------
-- Delivery_Status_History (Req 16.2): one row per status transition.
-- fromStatus is NULL for the initial Created transition.
-- ---------------------------------------------------------------------------
CREATE TABLE "Delivery_Status_History" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "deliveryId"  uuid NOT NULL REFERENCES "Delivery"(id) ON DELETE CASCADE,
  "fromStatus"  delivery_status,
  "toStatus"    delivery_status NOT NULL,
  reason        text CHECK (reason IS NULL OR length(reason) BETWEEN 1 AND 500),
  "occurredAt"  timestamptz NOT NULL DEFAULT now()
);

-- Ordered history lookups per delivery (Req 16.2).
CREATE INDEX "Delivery_Status_History_delivery_ts_idx"
  ON "Delivery_Status_History" ("deliveryId", "occurredAt");

-- ---------------------------------------------------------------------------
-- Retention policy configuration (Req 16.1)
-- ---------------------------------------------------------------------------
CREATE TABLE "Retention_Policy" (
  id                 text PRIMARY KEY,
  description        text NOT NULL,
  "retentionInterval" interval NOT NULL,
  -- Enforce the floor mandated by Req 16.1: never less than 365 days.
  CONSTRAINT "Retention_Policy_min_365_days"
    CHECK ("retentionInterval" >= interval '365 days')
);

INSERT INTO "Retention_Policy" (id, description, "retentionInterval")
VALUES (
  'completed_failed_deliveries',
  'Completed and failed Delivery records (and their status history) are retained for at least 365 days (Req 16.1).',
  interval '365 days'
);

-- ---------------------------------------------------------------------------
-- Guarded purge: removes only terminal deliveries older than the retention
-- window. Completed uses completedAt; failed uses the most recent history
-- transition into Failed (fallback updatedAt). Returns rows removed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_expired_deliveries()
RETURNS integer AS $$
DECLARE
  retention interval;
  removed integer;
BEGIN
  SELECT "retentionInterval" INTO retention
  FROM "Retention_Policy"
  WHERE id = 'completed_failed_deliveries';

  IF retention IS NULL THEN
    RETURN 0;
  END IF;

  WITH terminal AS (
    SELECT
      d.id,
      CASE
        WHEN d.status = 'Completed'
          THEN COALESCE(d."completedAt", d."updatedAt")
        ELSE COALESCE(
          (SELECT max(h."occurredAt")
             FROM "Delivery_Status_History" h
            WHERE h."deliveryId" = d.id AND h."toStatus" = 'Failed'),
          d."updatedAt"
        )
      END AS terminal_at
    FROM "Delivery" d
    WHERE d.status IN ('Completed', 'Failed')
  ),
  deleted AS (
    DELETE FROM "Delivery"
    WHERE id IN (
      SELECT id FROM terminal
      WHERE terminal_at < now() - retention
    )
    RETURNING id
  )
  SELECT count(*) INTO removed FROM deleted;

  RETURN removed;
END;
$$ LANGUAGE plpgsql;

COMMIT;
