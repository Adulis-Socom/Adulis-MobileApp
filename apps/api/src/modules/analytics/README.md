# Analytics

**ADU-API-01 v1.3 endpoint group:** gap register items 14, 22 — not catalogued in ADU-API-01 v1.3

**Built in:** ADU-CON-02 v3.0 section 15, Tier 8

Carries R19: analytics.event monthly partitions older than the 90-day live window are detached, exported to R2 as Parquet, and dropped. The analytics schema has no foreign keys into it by design — the pre-built relief valve.

---

TIER 0 — this folder is a placeholder. No controller, no service, no Zod
schema, no spec file. Nothing here is registered in `app.module.ts`.

When this module is built it holds exactly:
`*.controller.ts` · `*.service.ts` (one database function call) · `*.schemas.ts` (Zod) · `*.spec.ts`

The service is thin on purpose: ADU-API-01 section 13 requires a
state-changing endpoint to call one named database function and do nothing
else of consequence. No endpoint computes a trust level, an entitlement, an
expiry, a readiness state or a scan validity.
