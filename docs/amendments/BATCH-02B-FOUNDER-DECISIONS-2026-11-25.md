# Batch 02B founder decisions -- addendum of 25 November 2026

Status: founder decisions recorded for the MVP build stage, continuing
`BATCH-02-FOUNDER-DECISIONS-2026-11-25.md` (B02-D01..D05). Working authority, not a signed board,
legal or licensing approval. It does not authorise any code, database or infrastructure change by
itself; each change needs its own work order. It does NOT alter the November 8 pack, the November 24
decision register (D24-01..D24-18) or any historical record. Identifiers are new and unique
(B02B-D01..B02B-D05).

Order of authority is unchanged: the latest explicit founder decision, then the Batch 02 addendum,
then the November 24 register and amendments, then the November 8 reconciled pack, then compatible
prototype UX, then historical specifications and existing code as evidence of what is built.
Historical implementation is not permission to preserve obsolete product behaviour.

## Decisions

### B02B-D01 -- The Reservation model is retired from the intended active architecture
Reservation is a legacy model. No new feature is built on it, and every active Reservation
operation is removed or quarantined (fail-closed) rather than hidden: creation, acceptance or
cancellation, Can't Fulfil implemented as Reservation cancellation, expiry, stock holds and
releases, Reservation-specific states and countdowns, Reservation jobs and API mutations,
Reservation-derived notifications, obligations and analytics, Reservation management UI,
Reservation fixtures, and any assumption that an Order must contain Reservations.

The governing November Order model is ADU-ORDER-01 v3.3 (Payment Attempt, Checkout Inventory
Allocation, derived Order state: sections 16-18, 35-37, 51-52 and 59 of the Nov 8 pack). It names
no Reservation entity. It depends on payment authority, which is undecided (D24-01), so no
replacement Order lifecycle is built or invented here. Live Order creation stays deferred; a real
Cart and checkout review reserve no inventory; internal simulations never use Reservation
infrastructure.

SUPERSEDED IN PART by the founder's pre-launch architectural authorization (25 November 2026,
later the same day): Adulis has not launched, backward compatibility with obsolete unreleased
application versions is no longer a design requirement, and the Reservation model is retired
COMPLETELY from the active architecture rather than quarantined. Obsolete unreleased compatibility
contracts (endpoints, DTOs, enums, fields, error codes, fixtures, jobs) may be removed outright, and
breaking internal API, database, service, fixture and application changes are authorized where
retirement needs them. What still binds: applied migration history is preserved and changed only by
forward migrations; no unknown or valuable persistent database is reset, rebuilt or migrated; a
database holding legacy commerce rows needs an explicit export-or-rebuild decision before the
retiring migration applies; stock history and stock invariants are never erased or faked; nothing
replaces the retired model while payment authority is unresolved.

### B02B-D02 -- Courier relationship management is retained
Authorised Courier invitations stay: invite a Courier, view invitation status, view authorised
Courier relationships, revoke where permitted. Live Order assignment, custody transfer, handoff
credentials, live delivery execution and delivery compensation stay deferred. The interface must
distinguish relationship management from unavailable delivery execution. Closes the question
recorded as B2-018.

### B02B-D03 -- The Seller Console MVP is light-theme-first
Public dark-theme selection or activation in the Seller Console is deferred. The theme
architecture, the shared dark token definitions and the inactive Mobile appearance settings are
preserved untouched. The known 4.23:1 dark `textMuted` on `surfaceMuted` pair (B2-013) stays
recorded; dark-theme WCAG compliance is not claimed until dark-theme accessibility work is
authorised.

### B02B-D04 -- Authorised backend safety exception
The Console workstream stays forbidden from editing backend, migration and generated-contract files.
Three work orders are separately authorised for the backend workstream only, started from
`apps/api` with its own CLAUDE.md and permissions: BE-RES-01 (retire active Reservation backend
behaviour), BE-SAFE-01 (financial and transactional containment, including response payloads of
retained reads) and BE-READY-01 (remove PAYOUT_DETAILS from readiness and publication). No
permission is weakened. No Fastify, Drizzle or BullMQ change, no deploy, no persistent-database
operation and no environment change is authorised by this exception.

### B02B-D05 -- Conditional acceptance of the Console test reduction
The real-API Console suite may shrink from 88 to 79 tests (B2-014) provided each superseded
scenario is replaced by meaningful negative coverage and no security or authorisation test is
lost. Legacy Reservation behaviour is not restored to restore a test count. The D-167
Reservation/payment deadline scenario is retired with the model; its refetch-loop protection is
kept only if another approved live feature needs it (B2-007).

## Boundaries that do not change
Payment authority stays unresolved: no PSP, Buyer payment collection, Seller payment confirmation,
payment evidence, refund, settlement, surcharge or paid Order. Checkout stays Option A plus
Option C. Subscription Option B and Payout Option A stand. Source-code containment does not secure
an older deployed commit; deployment exposure (B2-002) remains a public-release blocker until it is
verified.
