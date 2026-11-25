# Clean rebuild authority -- addendum of 25 November 2026

Status: founder direction recorded for the pre-launch clean rebuild. Working authority, not a signed board,
legal or launch approval. It authorises NO code, database, deployment or merge by itself; each change needs
its own work order from the clean-rebuild master plan
(`Adulis_Clean_Rebuild_Master_Workorders_2026-11-25`, 106 work orders, held with the founder inputs, not in
this repository). Identifiers below are new and unique (RB25-D01..RB25-D08). The 8 and 24 November records,
B02-D01..D05 and B02B-D01..D05 are not altered; where they speak about preserving or migrating the LEGACY
stack, RB25-D01 says which lineage they now describe.

Order of authority: the latest explicit founder decision (this addendum, B02B, B02) > the November 24
register and amendments and supplemental contracts > the November 8 designs for unchanged details >
compatible prototype UX > archived code and contracts as evidence only.

## Decisions

### RB25-D01 -- A clean replacement lineage, not another legacy patch
The founder directs a pre-launch clean rebuild of the active runtime from the latest designs, in this
repository, on an isolated integration branch (`rebuild/2026-11-25`) with a NEW schema lineage.
- The LEGACY lineage is dev at `64d2e8ca9c10717fa7c4933b8e3cc4fca62b64e5` (migrations 0001-0062) plus draft
  PR #191 (`482938f`, migration 0063) and draft PR #188 (`3e1d09b`). It is archived as evidence. Its migration
  chain, generated contract, compatibility routes and table counts do **not** bind the replacement lineage.
- Every legacy-preservation instruction in this repository ("keep every SQL migration as written", "do not
  remove the legacy stack", "follow the controlled migration plan", node-pg-migrate pinning, Appendix-C
  counts) describes the ARCHIVED legacy lineage only. The replacement lineage starts with its own migrations
  and its own gates.
- The approved target stack (D24-08..D24-10: NestJS on Fastify, PostgreSQL with Drizzle, BullMQ on Valkey)
  is built clean in Stage B (ARC-BE-01..06) after Batch 01A is accepted. No Express, Kysely, Graphile Worker
  or node-pg-migrate runtime in the replacement. Stage B is not authorised by this addendum alone.
- Legacy code, tests and assets are evidence. Only an individually verified asset (REUSE VERIFIED in the
  Batch 01A ledger) may be carried; there is no blanket copy of legacy modules, schema or tests.

### RB25-D02 -- Existing data and environments are protected
`adulis-postgres` (5 non-seed accounts, 5 Orders, 5 Reservations, 4 active holds), its volumes, the object
store and any backups are preserved. The replacement lineage NEVER points at that database; migration 0063 is
not applied to it; no real data is copied into seeds. The replacement uses a new disposable database with its
own identity and namespace. Retiring old data later requires owner disposition, a full backup with a tested
restore, an object-store mapping and named approval. Staging/Render existence is unknown and is verified
read-only; nothing is deployed as part of rebuilding. main is untouched.

### RB25-D03 -- Payment stays deferred; Subscription B and Payout A unchanged
Payment authority remains OPEN (D24-01). No payment provider, Seller payment confirmation, surcharge, refund,
live Order, live delivery, payout collection or purchase-derived Review Grant. Checkout A (server-authoritative
review that never creates an Order or a stock hold) and C (isolated, development-only simulation) stand.
Subscription Option B (B02-D01) and Payout Option A (B02-D02) stand. **No future paid-commerce table is created
as a placeholder** in the replacement schema.

### RB25-D04 -- No retired model in the replacement
No Reservation (B02B-D01), legacy Order family, payment, handoff or payout model, table, grant, enum, state
machine, job, DTO, route, fixture or copy exists in the replacement lineage. Legitimate non-financial Cart,
Courier invitations and relationships (B02B-D02), privacy, and subscription plans and status are designed, not
dropped. The governing November Order model (ADU-ORDER-01 v3.3) remains payment-dependent and deferred.

### RB25-D05 -- Light-first visual authority
The CTO palette through shared semantic tokens (B02-D03, B02-D04) and a light-first Console (B02B-D03). The
general theming architecture is kept; the legacy blue and terracotta values are absent from the target theme.
No public dark theme without an approved design. One standout lime action per screen; measured contrast.

### RB25-D06 -- Execution sequence
Batch 01A (GOV-01..07, RBL-01..04: governance and preparation, no feature code) -> Batch 01B (ARC-BE-01..06,
RBL-05: shared platform skeleton) -> then one surface at a time, frontend then backend: Seller Console, Mobile,
Storefront, Operator. The skeleton-first step is a deliberate, limited exception to frontend-first so no new
frontend is anchored to the legacy stack. Company Website stays excluded. Each batch starts only after the
previous batch is accepted.

### RB25-D07 -- Legacy pull requests are references
#191 and #188 are not merged by default and are not prerequisites. #191's fixes and tests are carried as
requirements (stock-ledger release rules, permission negatives, readiness without payout); #188's isolation
cases are carried into SC-FE-01/SC-FE-12. No legacy work is marked accepted in the replacement.

### RB25-D08 -- What stays separately gated
Public launch (its own founder go/no-go), payment authority, the exact subscription-debt and account-deletion
policy, Staff Operator activation, public Amharic, and further Market activation. A domain detail the sources
leave unresolved is recorded as a specific decision and blocks only the affected work.
