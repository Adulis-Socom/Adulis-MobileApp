# WO-INFRA-013 -- Database integrity audit (and the work-order report)

**Status of the work order: PARTIALLY COMPLETE.**
- **Done:** the audit, the root cause, the recovery point, the repair procedure, and its rehearsal on a
  copy (restore with every key validated).
- **LIVE REPAIR BLOCKED** pending the founder's approval. The development database was not modified.

13 November 2026. **Logs:** `G:\AdulisDevelopment\WO-INFRA-CLOSURE\logs\` (`devdb-fk-audit.*`,
`devdb-orphan-patterns.log`, `wo013-*`).

## 1. Work order
WO-INFRA-013, development database integrity recovery (P1).

## 2. Initial state
- **The historical finding:** five foreign keys failed when the first batch's dump was restored
  (ISSUE-INFRA-FOLLOWUP-005), with examples "15 devices, 3 notifications".
- **Re-inspected today, read-only:** `ops/scripts/fk-audit.mjs` (forced read-only session) and
  `psql` with `default_transaction_read_only=on`.

## 3. Audit results (task 1)
`fk-audit` on the development database (`127.0.0.1:5434/adulis`, migrations 0001 to 0053): **175 keys,
192 orphaned rows on five of them**.

| Key | Orphans | Missing parent(s) | Identity of the rows |
|---|---|---|---|
| `otp_delivery_attempt_otp_challenge_id_fkey` | **155** | 155 distinct challenges | written 2026-11-09 08:32 to 21:44 UTC, a day suites ran against this database |
| `device_market_id_fkey` | **15** | 1: `cccc6666-3333-4000-8000-000000000001` | the `c6-accounts` fixture market; devices first seen 2026-11-09 |
| `order_state_transition_order_id_fkey` | **10** | 10 orders (random ids) | transitions of orders that teardowns deleted |
| `claim_evidence_item_claim_id_fkey` | **9** | 3 claims | evidence items of deleted claims |
| `notification_recipient_account_id_fkey` | **3** | 1: `26262626-2626-4000-8000-000000000030` | the `t26-ownership-before-rules` fixture account |

- **Constraints marked valid despite violating rows:** all five (`convalidated = t`). PostgreSQL
  checked them at creation; replica mode switched their triggers off when the parents went.
- **Unvalidated constraints:** none.
- **Duplicate records relevant to the failed restore:** none. The restore failed only on these five
  foreign keys (reproduced exactly on a copy, section 5).
- **Rows depending on the orphans:** none. Only `session`, `account_device` and `cart` reference one
  of the five tables (`core.device`), and **0** of their rows reference an orphaned device. Nothing
  references the other four tables.
- **Valuable development data:** none found. Every orphan is a fixture id, the child of a fixture id,
  or a row written by the suites' own flows. All 15 devices are on the fixture market; all 3
  notifications go to the fixture account.

## 4. Root cause (task 2)
1. **The target.** The API suites ran against this database by default: the test script loads the root
   `.env` (WO-INFRA-012, section 2).
2. **The teardowns.** They delete parents under `session_replication_role = replica` (needed to get
   past append-only triggers), and replica also switches off foreign keys. When the children are not
   deleted first, they are orphaned silently. The leaking teardowns are listed in
   `WO-INFRA-012-TEST-DATABASE-AUDIT.md`, section 6 (24 files).
3. **The proof.**
   - A fresh disposable database: 201 keys hold.
   - After one full API run: 35 orphans on **the same five keys**, the same counts on three separate
     runs, with or without the root `.env`.
   - The development database's 192 is that residue accumulated over several runs (the 155 OTP
     attempts alone come from one day of runs).

**Is recurrence prevented?** Yes, for this database. Since WO-INFRA-012:
- the suites, the load tests and the writing gates refuse it;
- in disposable databases, the API run's teardown audit fails on any new leak key, and the five known
  ones disappear with each recreated database.

## 5. Recovery point (task 3)

| | |
|---|---|
| Fresh dump | `G:\AdulisDevelopment\WO-INFRA-CLOSURE\backup\adulis-dev-20261113T113549Z.dump`, 724,402 bytes, SHA-256 in `SHA256SUMS.txt` (checked OK). `pg_dump` is read-only |
| Same as last night's | yes: the same size as the first batch's `adulis.dump`, and the same five failures. No suite has touched the database since |
| Restore, as it is | on a disposable PostgreSQL 17 (roles from the passwordless export): data loads; **exactly five errors**, one per key above |
| Constraints on the copy | the five are absent, because their `ADD CONSTRAINT` failed. An audit of such a copy would miss them, so the rehearsal re-adds them from the dump |

## 6. Repair (tasks 4 to 6)
- **The plan:** `WO-INFRA-013-REPAIR-PLAN.md`.
- **The script:** `WO-INFRA-013-repair.sql`.
- **The rehearsal evidence:** `WO-INFRA-013-RESTORE-VALIDATION.md`.

The rehearsal on a copy ends with **all 175 foreign keys holding**, and the repaired dump restoring with
`--exit-on-error`.

## 7. Files
- **Inspected:** the development database (read-only), the API teardowns, `pg_constraint`, the dump's
  TOC.
- **Added:** `docs/infrastructure/WO-INFRA-013-repair.sql` (not a migration; dev-only, approval
  required), and these three reports.
- **Not modified:** the development database, every migration, every application file.

## 8. Security review
- **Read-only audit:** enforced by the session setting.
- **No credentials:** none printed or stored. The disposable copies used throwaway passwords and no
  published port.
- **The archive:** the CSV of the 192 rows (rehearsal) holds test data only, on the SSD.

## 9. Final status
- **Implementation and rehearsal:** COMPLETE.
- **Live repair: BLOCKED** pending founder approval.
- **Commit SHA:** the WO-INFRA-013 commit on `infra/wo-infra-010-014-closure`
  (`git log --grep WO-INFRA-013`).
