# Content reports

**ADU-API-01 v1.3 endpoint group:** gap register item 12 — POST /v1/reports

**Built in:** ADU-CON-02 v3.0 section 15, Tier 8

App-store mandated (ADU-CON-01 section 18): report on every piece of user content. Blocking for the beta.

---

TIER 0 — this folder is a placeholder. No controller, no service, no Zod
schema, no spec file. Nothing here is registered in `app.module.ts`.

When this module is built it holds exactly:
`*.controller.ts` · `*.service.ts` (one database function call) · `*.schemas.ts` (Zod) · `*.spec.ts`

The service is thin on purpose: ADU-API-01 section 13 requires a
state-changing endpoint to call one named database function and do nothing
else of consequence. No endpoint computes a trust level, an entitlement, an
expiry, a readiness state or a scan validity.
