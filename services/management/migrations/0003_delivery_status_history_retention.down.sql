-- Migration 0003 (down): drop delivery status history + retention policy
--
-- Reverses 0003_delivery_status_history_retention.up.sql.

BEGIN;

DROP FUNCTION IF EXISTS purge_expired_deliveries();
DROP TABLE IF EXISTS "Retention_Policy" CASCADE;
DROP TABLE IF EXISTS "Delivery_Status_History" CASCADE;

COMMIT;
