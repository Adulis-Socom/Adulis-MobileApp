# Claims

**ADU-API-01 v1.3 endpoint group:** section 12.4 / ADU-DB-01 section 16

**Built in:** ADU-CON-02 v3.0 section 15, Tier 8

The endpoint inserts core.claim and the evidence trigger populates the set. Claim scope is line-level (ADU-DB-01 C8).

---

TIER 0 — this folder is a placeholder. No controller, no service, no Zod
schema, no spec file. Nothing here is registered in `app.module.ts`.

When this module is built it holds exactly:
`*.controller.ts` · `*.service.ts` (one database function call) · `*.schemas.ts` (Zod) · `*.spec.ts`

The service is thin on purpose: ADU-API-01 section 13 requires a
state-changing endpoint to call one named database function and do nothing
else of consequence. No endpoint computes a trust level, an entitlement, an
expiry, a readiness state or a scan validity.
