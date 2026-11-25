---
name: adulis-order-concurrency
description: >-
  Designs and tests Adulis order, stock, payment-state, expiry, partial-fulfilment, and handoff concurrency/idempotency. Use for any commerce state transition or background job that can race or retry.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "CEO-backend"
  priority: "P0"
  version: "1.1.0"
---

# Adulis Order Concurrency


## Shared source protocol

Read `.claude/reference/CURRENT_MVP_AUTHORITY.md` and `DOCUMENT_AUTHORITY.md` from the repository root. Locate the founder-provided Nov24 pack (or configured `ADULIS_SPEC_ROOT`), read `Governance/DECISION_REGISTER_2026-11-24.md` and applicable `Effective_Current_Designs/Markdown` amendment before the Nov8 body. If the necessary source cannot be read, report `MISSING_SOURCE`; do not guess. Historical executable references below describe what is built, not contrary design authority. Missing live contracts are `SPEC_VERSION_GAP` or `CONTRACT_GAP`; approved frontend-only typed fixtures may proceed without inventing a live contract. Confirm named work-order scope before editing. Preserve existing permission denials and safeguards.

## Current MVP constraints — 24 November 2026

Live payments, paid Orders, handoff, purchase Review Grants and payment Claims deferred. Checkout preview never places an Order or reserves stock. Internal simulations cannot mutate real stock/trust. Preserve future concurrency checks; for live Stories/Scenes prove expiry/public eligibility and idempotent worker retries. BullMQ at-least-once execution cannot duplicate effects. The Reservation model is RETIRED (B02B-D01): do not design, extend or test new Reservation creation, hold, expiry or release; the existing expiry sweep is a drain of historical holds only and is kept until a founder-approved reconciliation. The governing Order model is ADU-ORDER-01 v3.3 (Payment Attempt, Checkout Inventory Allocation), deferred with payment.

## Governing sources (legacy executable references unless noted)
- `ADU-DB-01_Database_and_Data_Model_v1_27_ASCII.md` — constraints/state machines.
- `ADU-API-01_API_Contract_v1_11_ASCII.md` — idempotency/retry wire.
- `ADU-PRD-01_Product_Requirements_v8_5.md` — product lifecycle; note DB write-backs W3/W6/W8.
- `ADU-CON-02_Seller_Console_System_Design_v3_2_ASCII.md` — build tier and hardening requirements.

## Required questions for every change
1. What happens when two requests execute concurrently?
2. What database constraint/function is authoritative?
3. What happens if the transaction commits and the response is lost?
4. What happens if the same client retries with the same idempotency key?
5. What happens if the worker runs twice?
6. What happens if two different actors act on the same order at once?
7. Is stock released/decremented exactly once?
8. Can a stale client submit an otherwise valid but now-illegal transition?

## Core rules for future authorized transactions (not live MVP)
- cart holds no stock; order creation revalidates;
- (retired model, history only) reservation uniqueness is structural for historical data;
- stock cannot go negative and cannot move without the stock-event mechanism;
- expiry/release jobs are idempotent;
- writes use client idempotency semantics;
- legal state transitions are ratified data/functions, never free-form application logic;
- partial fulfilment and line-level outcomes must not corrupt order-level derived state;
- QR/offline sync must distinguish legitimate retry from malicious replay.

## Test standard
Use real PostgreSQL integration tests for concurrency and invariant proof. Include simultaneous requests, duplicate job execution, lost-response replay, stale state, and scope failure. Do not accept a unit test with mocked repositories as proof of concurrency correctness.

## Output contract
```text
CONCURRENCY REVIEW
Operation:
Race participants:
Authoritative constraint/function:
Lock/transaction semantics:
Idempotency behavior:
Worker retry behavior:
Failure mapping:
Required concurrent integration tests:
Spec gap/write-back:
Verdict:
```
