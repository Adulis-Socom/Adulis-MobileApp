# Payment

**ADU-API-01 v1.3 endpoint group:** sections 12.5 — Payment instructions (the C3 endpoint) and payment confirm/reject

**Built in:** ADU-CON-02 v3.0 section 15, Tier 6

The seller is the verifier (ADU-CON-01 loop 5). Evidence reads are logged with the DERIVED role. R15/R18: the function returns ciphertext plus a key reference and the API streams ~64 KB AEAD frames.

---

TIER 0 — this folder is a placeholder. No controller, no service, no Zod
schema, no spec file. Nothing here is registered in `app.module.ts`.

When this module is built it holds exactly:
`*.controller.ts` · `*.service.ts` (one database function call) · `*.schemas.ts` (Zod) · `*.spec.ts`

The service is thin on purpose: ADU-API-01 section 13 requires a
state-changing endpoint to call one named database function and do nothing
else of consequence. No endpoint computes a trust level, an entitlement, an
expiry, a readiness state or a scan validity.
