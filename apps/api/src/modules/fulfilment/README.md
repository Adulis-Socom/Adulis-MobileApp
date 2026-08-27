# Fulfilment methods

**ADU-API-01 v1.3 endpoint group:** not catalogued in ADU-API-01 v1.3

**Built in:** ADU-CON-02 v3.0 section 15, Tier 2

seller_fulfilment_method is added by ADU-CON-02 v3.0 section 15 Tier 2 and is one of the two tables taking the manifest from 105 to 107. It carries NO fee column — open item O-6, deliberately deferred; either PRD ruling is a migration.

---

TIER 0 — this folder is a placeholder. No controller, no service, no Zod
schema, no spec file. Nothing here is registered in `app.module.ts`.

When this module is built it holds exactly:
`*.controller.ts` · `*.service.ts` (one database function call) · `*.schemas.ts` (Zod) · `*.spec.ts`

The service is thin on purpose: ADU-API-01 section 13 requires a
state-changing endpoint to call one named database function and do nothing
else of consequence. No endpoint computes a trust level, an entitlement, an
expiry, a readiness state or a scan validity.
