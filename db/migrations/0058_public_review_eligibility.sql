-- ============================================================================
-- 0058 -- Public Review eligibility (WORK ORDER WO-007A; founder decision
--         ON-20261111-033; ADU-REV-01 v3.3 S1-S2, S7, S14-S16, S30, S47, S54;
--         ADU-DB-01 v1.24)
--
-- REV-01: a Review may be public, and count in a public rating, only on an
-- authoritative evidence basis -- FINAL_HANDOFF (verified payment + accepted
-- final DELIVERY receipt) or VERIFIED_ORDER_FAILURE (verified payment + an
-- upheld eligible Seller-fault Claim). "No unverified fallback" (S16); a
-- legacy badge is not proof (founder, ON-033). core.review keeps every row
-- (nothing is deleted or rewritten); this view decides what is PUBLIC, and
-- every public Review read and aggregate selects from it and nothing else.
--
-- THE PAYMENT TERM FAILS CLOSED. Both bases need authoritatively verified
-- payment. The executable system has none: core.payment_submission is the
-- Seller confirming a Buyer's screenshot ("Adulis NEVER asserts a payment is
-- genuine", 0012), which K-1 (founder ruling, WO-001C) retires as payment
-- truth -- "provider/backend-verified payment; no Seller payment
-- confirmation". fn_order_payment_verified is that owner evidence interface
-- (REV-01 S56 phase 1) and answers false for every Order until WO-PAY-001
-- gives it a provider-verified fact to read. Until then NO Review is public:
-- REV-01 S47, "fail closed ... whenever the required current basis cannot be
-- verified". Nothing here fabricates payment, receipt or Claim evidence.
--
-- The other terms, read live (a correction or reversal shows at once in the
-- list and the aggregate alike, because both read this view):
--   FINAL_HANDOFF  a VALID or LATE core.handoff_scan on the Order. That row is
--                  the Buyer's own QR scan of the final receipt (FK
--                  handoff_scanned_by_buyer); Courier PICKUP is
--                  core.courier_custody_transfer and never qualifies (S7).
--                  OTP and Manual receipt do not exist in the schema yet.
--   VERIFIED_ORDER_FAILURE  an UPHELD Claim on the Order whose trigger is
--                  GOODS_NOT_RECEIVED (non-delivery) or REFUND_NOT_DELIVERED
--                  (unpaid remedy) -- the two triggers REV-01 S1 names
--                  literally. Applies only without a final receipt
--                  ("Delivered Orders retain the existing receipt-based
--                  container", S1). Seller-service stars only: item ratings
--                  are never public through this view.
--   provenance     the Review's Seller is its Order's Seller; the Order Buyer
--                  is not the Seller's owner or a live team member (S50,
--                  self-review). The Buyer is bound by FK review_by_order_buyer.
--   moderation     no Review moderation state or decision vocabulary exists
--                  (moderation_event.decision is free text; no workflow writes
--                  a REVIEW target). Nothing is invented here; ON-20261111-029
--                  records it as a release blocker.
-- ============================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. The payment owner's evidence interface (fail closed)
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_order_payment_verified(p_order uuid) RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE
AS $fn$ SELECT false $fn$;

COMMENT ON FUNCTION core.fn_order_payment_verified(uuid) IS
  'REV-01 S56 phase 1 / K-1: true only when the payment owner holds a provider- or '
  'backend-verified payment for the Order. No such fact exists yet (Seller '
  'confirmation is not payment truth), so it answers false: fail closed. '
  'WO-PAY-001 replaces the body. p_order is unused until then.';

ALTER FUNCTION core.fn_order_payment_verified(uuid) OWNER TO adulis_migrate;
REVOKE ALL ON FUNCTION core.fn_order_payment_verified(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.fn_order_payment_verified(uuid)
  TO adulis_app, adulis_jobs, adulis_readonly;

-- ---------------------------------------------------------------------------
-- 2. The one public Review projection
-- ---------------------------------------------------------------------------
CREATE VIEW core.v_review_public AS
SELECT rv.id,
       rv.seller_id,
       rv.seller_rating,
       rv.body,
       rv.published_at,
       CASE WHEN e.final_handoff THEN 'FINAL_HANDOFF'
            ELSE 'VERIFIED_ORDER_FAILURE' END AS evidence_basis
  FROM core.review rv
  JOIN core."order" o ON o.id = rv.order_id AND o.seller_id = rv.seller_id
  JOIN core.seller s ON s.id = o.seller_id
 CROSS JOIN LATERAL (
   SELECT EXISTS (SELECT 1 FROM core.handoff_scan hs
                   WHERE hs.order_id = o.id
                     AND hs.validity IN ('VALID', 'LATE')) AS final_handoff,
          EXISTS (SELECT 1 FROM core.claim c
                   WHERE c.order_id = o.id
                     AND c.outcome = 'UPHELD'
                     AND c.trigger IN ('GOODS_NOT_RECEIVED', 'REFUND_NOT_DELIVERED')) AS upheld_failure
 ) e
 WHERE core.fn_order_payment_verified(o.id)
   AND (e.final_handoff OR e.upheld_failure)
   AND o.buyer_account_id IS DISTINCT FROM s.owner_account_id
   AND NOT EXISTS (SELECT 1 FROM core.seller_team_member tm
                    WHERE tm.seller_id = s.id
                      AND tm.account_id = o.buyer_account_id
                      AND tm.revoked_at IS NULL);

COMMENT ON VIEW core.v_review_public IS
  'ADU-REV-01 v3.3 S14-S16, S30 (WO-007A, ON-033): the one public Review read. A '
  'Review is public only on FINAL_HANDOFF or VERIFIED_ORDER_FAILURE with verified '
  'payment (fn_order_payment_verified, fail closed). Seller-service fields only; '
  'no order, buyer or claim reference leaves it. The public list and the public '
  'rating aggregate both select from here.';

GRANT SELECT ON core.v_review_public TO adulis_app, adulis_readonly;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
