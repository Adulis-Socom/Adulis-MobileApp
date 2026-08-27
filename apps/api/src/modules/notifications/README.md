# Notifications and preferences

**ADU-API-01 v1.3 endpoint group:** sections 11 and 11.1; gap register items 11, 21

**Built in:** ADU-CON-02 v3.0 section 15, Tier 8

Delivery closes the A6 race. Jobs enqueue in the SAME transaction as the state change, so the two commit or fail together. Every job is idempotent.

---

TIER 0 — this folder is a placeholder. No controller, no service, no Zod
schema, no spec file. Nothing here is registered in `app.module.ts`.

When this module is built it holds exactly:
`*.controller.ts` · `*.service.ts` (one database function call) · `*.schemas.ts` (Zod) · `*.spec.ts`

The service is thin on purpose: ADU-API-01 section 13 requires a
state-changing endpoint to call one named database function and do nothing
else of consequence. No endpoint computes a trust level, an entitlement, an
expiry, a readiness state or a scan validity.
