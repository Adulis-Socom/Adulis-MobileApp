---
name: adulis-order-concurrency
description: >-
  Designs and tests Adulis order, reservation, stock, payment-state, expiry, partial-fulfilment, and handoff concurrency/idempotency. Use for any commerce state transition or background job that can race or retry.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "CEO-backend"
  priority: "P0"
  version: "1.0.0"
---

# Adulis Order Concurrency


## Shared source protocol

Before acting:
1. Read `${CLAUDE_PROJECT_DIR}/.claude/reference/DOCUMENT_AUTHORITY.md` if present.
2. Locate the exact governing filenames listed below with `Glob`. Do not substitute an older revision when a newer named revision is required.
3. Read only the relevant sections first; expand if necessary.
4. If a required source is absent, output `MISSING_SOURCE` and name it.
5. If the task crosses a known unreissued-spec boundary, output `SPEC_VERSION_GAP` and do not guess.


## Governing sources
- `ADU-DB-01_Database_and_Data_Model_v1_6.md` — constraints/state machines.
- `ADU-API-01_API_Contract_v1_3.md` — idempotency/retry wire.
- `ADU-PRD-01_Product_Requirements_v8_5.md` — product lifecycle; note DB write-backs W3/W6/W8.
- `ADU-CON-02_Seller_Console_System_Design_v3_0.md` — build tier and hardening requirements.

## Required questions for every change
1. What happens when two requests execute concurrently?
2. What database constraint/function is authoritative?
3. What happens if the transaction commits and the response is lost?
4. What happens if the same client retries with the same idempotency key?
5. What happens if the worker runs twice?
6. What happens if two different actors act on the same order at once?
7. Is stock released/decremented exactly once?
8. Can a stale client submit an otherwise valid but now-illegal transition?

## Core rules
- cart holds no stock; order creation revalidates;
- reservation uniqueness is structural;
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
