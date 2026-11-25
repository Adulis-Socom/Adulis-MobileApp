# Rebuild founder rulings -- Batch 02A (RB25-D12..D14)

Working authority recorded from the founder's Batch 02A instruction of 25 November 2026. A narrow addendum
to `REBUILD-2026-11-25-CLEAN-LINEAGE.md`: it settles three items Batch 01B left open (register
RB-B01-05, RB-B01-13, RB-B01-07) and changes nothing else. Not a signed board or legal approval.

## RB25-D12 -- API wire naming (closes RB-B01-05, SPEC_CONFLICT)

- The HTTP wire contract uses snake_case. Domain events and job envelopes use snake_case.
- TypeScript internal variables and component properties may use camelCase.
- The top-level error envelope keeps exactly: `type`, `title_key`, `status`, `code`, `request_id`,
  `retryable`, optional `slots`, optional `items`. Each error item uses `message_key`.
- No duplicate casing aliases (no `requestId` beside `request_id`).
- The Console design's camelCase examples (CONSOLE-02 S146) do not override the canonical wire contract
  (ADU-API-01 S7 as carried by GOV-03 B-03). The implemented envelope (`apps/api/src/platform/problem.ts`)
  already conforms; nothing changes in code.

## RB25-D13 -- Background job envelope (closes RB-B01-13)

- Keep the canonical EVT-01 S15 envelope.
- Event-derived jobs carry an EMPTY business payload and re-read authoritative data from PostgreSQL.
- Safe operational metadata for routing, traceability, priority, versioning and context reconstruction
  stays (market, aggregate, correlation, causation, actor, priority, criticality, versions).
- Queue-supplied Market, aggregate and actor metadata are not independent authority: they are validated
  against the canonical durable records where applicable. Implemented in RBL-05-CLOSE: the consumer
  refuses any job whose identity, context or payload differs from what the relay derives from the
  durable event and delivery (`apps/api/src/worker/consumer.ts`, `deliveryMismatch`).
- No credentials, OTPs, personal documents, private message bodies or payment information in ordinary
  queue payloads.
- Future direct job intents may use minimal, explicitly approved, typed payloads (EVT-01 S14; added by the
  first domain work order that needs one).

## RB25-D14 -- Information-state colour (closes RB-B01-07)

- The current neutral information-state roles are approved: foreground `#333846` on background `#F4F5F7`.
- No new blue or other brand-adjacent information hue.
- Information is identifiable by iconography, label and text, never by colour alone.
- The approved CTO palette is preserved unchanged (`packages/tokens`, B02-D03).
