# RBL-03 -- PR #191 findings as clean-build requirements

Status: governance record. #191 (`482938f`, archived as `recovery/pr-191-482938f`) stays unmerged EVIDENCE; its
removal migration 0063 is not brought into the replacement lineage (there is nothing to remove there). Its
fixes become behaviour requirements with tests in the replacement. Every carried finding (B, B2, B2B, PL:
52 IDs) has a disposition in `RBL-03-FINDING-DISPOSITION.csv` (21 REQUIREMENT, 6 ABSENCE, 13 RESOLVED,
4 OBSOLETE, 4 OPEN-FOUNDER, 4 OPEN-ENV).

## Requirements
**R3-1 Stock ledger (from the #191 review fix ffc1d33; B2B-002).** Stock changes only through an append-only
stock ledger owned by the catalogue domain (CATINV-01). No ledger reason or release rule is bound to a
Reservation, an Order or a payment (none exists). Stock never goes negative; a concurrent adjustment is
serialised; an idempotent retry does not double-apply. Owner: ARC-BE-03 (constraints), SC-BE-04 (API).

**R3-2 Permission negatives (#191 removed 13 permissions and 39 operations).** The replacement permission
catalogue is built from AUTH-02 for active domains only. Tests: every retired permission code is absent from the
catalogue and refused if presented; table, column, inherited and function privileges are checked for every
role (no grant on a table that does not belong to an active domain, no write on inert structure because there
is none). Owner: ARC-BE-03 (grants), SC-BE-02 (catalogue), ARC-BE-06 (absence).

**R3-3 Market activation without the retired state machine.** In the legacy lineage a Market carried a
`core.timing_config` row with reservation, payment-confirmation, fulfilment, offline-sync and payout-activation
windows, and writes failed with `NO_TIMING_CONFIG` when none was in force. In the replacement, activating the
Ethiopia Market depends only on MKT-01's non-financial configuration (currency, timezone, locales, Seller
coverage), never on reservation, payment, payout or handoff timing. Tests: the Market activates with no
commerce timing configured; no non-financial write is gated on commerce timing. Owner: SC-BE-03 (and OP-BE-06
for controlled config changes).

**R3-4 Subscription without debt (Subscription B).** Plans, status and server-resolved entitlements exist;
purchase does not. Nothing accrues debt: no invoice, no unpaid balance, no job or transition that moves a
subscription to a past-due state from non-payment. Tests: no route, job or state transition creates debt; the
status values are the approved non-financial ones. Owner: SC-BE-06 (API), SC-FE-10 (UI), ARC-BE-06 (absence of
purchase).

**R3-5 Deletion and closure without impossible blockers (PL-003).** Seller closure and account deletion follow
the approved non-financial and privacy rules (PRV-01, retention honoured). There is no settle-payment blocker
(payment cannot occur) and no subscription-debt blocker (no debt can exist). **If the founder later approves a
debt or deletion policy (OD-02), the affected blocker is built then; until that decision, it is not implemented
and the behaviour that needs it stays gated.** Valid retention requirements are never bypassed. Owner: SC-BE-06,
SC-FE-11.

## Targeted test plan (to be implemented in the named orders; nothing is implemented in Batch 01A)
| Test | Kind | Order |
|---|---|---|
| T3-1 ledger: negative stock refused; concurrent adjust serialised; idempotent replay single-applied; no order/reservation reason value exists | database + API | ARC-BE-03, SC-BE-04 |
| T3-2 privileges: every role x table/column/function grant matches the catalogue; retired codes absent and refused | database + API | ARC-BE-03, SC-BE-02, ARC-BE-06 |
| T3-3 Market: activation with no commerce timing succeeds; no NO_TIMING_CONFIG-style gate on non-financial writes | API | SC-BE-03 |
| T3-4 subscription: no debt-creating route, job or transition; purchase absent | API + absence | SC-BE-06, ARC-BE-06 |
| T3-5 deletion/closure: no settle-payment or debt blocker; retention rules applied; OD-02 gate documented | API | SC-BE-06 |
| T3-6 absence: id-carrying retired routes probed with real ids (PL-010) | API | ARC-BE-06 |
