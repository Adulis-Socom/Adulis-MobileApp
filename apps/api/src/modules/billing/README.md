# Subscription and billing

**ADU-API-01 v1.3 endpoint group:** section 12.12 — Seller team, subscription, deletion

**Built in:** ADU-CON-02 v3.0 section 15, Tier 7

Entitlement is not permission (ADU-AUTH-01 section 18). Every capability gate calls billing.fn_effective_limit; no stored entitlement boolean ever. Billing suspension leaves orders operable. NOTE: ADU-CON-01 F4 records that ADU-API-01 section 12.12 contradicts section 4.1 on this group's audience.

---

TIER 0 — this folder is a placeholder. No controller, no service, no Zod
schema, no spec file. Nothing here is registered in `app.module.ts`.

When this module is built it holds exactly:
`*.controller.ts` · `*.service.ts` (one database function call) · `*.schemas.ts` (Zod) · `*.spec.ts`

The service is thin on purpose: ADU-API-01 section 13 requires a
state-changing endpoint to call one named database function and do nothing
else of consequence. No endpoint computes a trust level, an entitlement, an
expiry, a readiness state or a scan validity.
