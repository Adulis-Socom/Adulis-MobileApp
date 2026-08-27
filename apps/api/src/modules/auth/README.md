# Identity and session

**ADU-API-01 v1.3 endpoint group:** section 12.2 — Identity and session

**Built in:** ADU-CON-02 v3.0 section 15, Tier 3

Both credentials: the __Host-adulis_session cookie for the console and Authorization: Bearer for mobile. Carries remember-device (R17). SPEC_VERSION_GAP: the R17 lifetimes are not in ADU-AUTH-01 v2.0; they arrive in v2.1.

---

TIER 0 — this folder is a placeholder. No controller, no service, no Zod
schema, no spec file. Nothing here is registered in `app.module.ts`.

When this module is built it holds exactly:
`*.controller.ts` · `*.service.ts` (one database function call) · `*.schemas.ts` (Zod) · `*.spec.ts`

The service is thin on purpose: ADU-API-01 section 13 requires a
state-changing endpoint to call one named database function and do nothing
else of consequence. No endpoint computes a trust level, an entitlement, an
expiry, a readiness state or a scan validity.
