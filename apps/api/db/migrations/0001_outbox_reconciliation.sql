-- 0001_outbox_reconciliation -- replacement lineage rebuild-20261125 (RBL-05-CLOSE).
-- Transcribes ADU-EVT-01 v3.2 S23 reconcile_outbox: event_outbox + event_delivery + the consumer registry are the
-- durable authority for repairing missing or stale physical queue deliveries. Runs as adulis_migrator.
-- reconcile_attempts bounds rematerialisation per delivery, so a job that keeps getting lost ends as a dead letter,
-- not as an endless loop. reconcile_checked_at is the reconciler's own lease: looking never touches updated_at, so
-- the staleDeliveries health gauge (updated_at) keeps showing work that is genuinely stuck. The partial index serves
-- the reconciler's bounded stale scan.
ALTER TABLE platform.event_delivery ADD COLUMN reconcile_attempts integer NOT NULL DEFAULT 0 CHECK (reconcile_attempts >= 0);
--> statement-breakpoint
ALTER TABLE platform.event_delivery ADD COLUMN reconcile_checked_at timestamptz;
--> statement-breakpoint
CREATE INDEX event_delivery_unfinished ON platform.event_delivery (updated_at)
  WHERE state IN ('PENDING', 'ENQUEUE_UNKNOWN', 'QUEUED', 'PROCESSING');
--> statement-breakpoint
GRANT UPDATE (reconcile_attempts, reconcile_checked_at) ON platform.event_delivery TO adulis_worker;
