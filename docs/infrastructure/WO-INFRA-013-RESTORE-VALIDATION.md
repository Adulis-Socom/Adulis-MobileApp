# WO-INFRA-013 -- Restore validation (repair rehearsal on a copy)

**Where:** every step ran on a disposable copy. `infra-repair-pg` (PostgreSQL 17, no published port)
held the restored development dump; the verification database `repair_verify` ran on the disposable test
server. **Both were removed afterwards.**

**Logs:** `wo013-recovery-point.log`, `wo013-dependents.log`, `wo013-rehearsal-A-C.log`,
`wo013-rehearsal-D-G.log`. **Archive:** `G:\AdulisDevelopment\WO-INFRA-CLOSURE\repair-rehearsal\`.

| Step | What | Result |
|---|---|---|
| Recovery point | `pg_dump` of the development database (read-only), checksummed | `adulis-dev-20261113T113549Z.dump`, 724,402 bytes, checksum OK |
| Restore as it is | into the copy, roles first | data loads; **five errors**, exactly the five keys (`device_market_id_fkey`, `notification_recipient_account_id_fkey`, `order_state_transition_order_id_fkey`, `claim_evidence_item_claim_id_fkey`, `otp_delivery_attempt_otp_challenge_id_fkey`) |
| Dependents | foreign keys into the five tables; rows referencing the orphans | only `session`, `account_device`, `cart` reference `core.device`: **0** rows reference an orphan |
| Fixture identity | | all 15 devices on market `cccc6666-...`; all 3 notifications to account `26262626-...-030` |
| A. Archive | read-only CSV export of the exact rows | device 15, notification 3, order_state_transition 10, claim_evidence_item 9, otp_delivery_attempt 155 (192), plus `ARCHIVE-SHA256SUMS.txt` |
| B. Repair | `WO-INFRA-013-repair.sql` on the copy | `COMMIT`; "192 orphaned rows removed" |
| C. Re-add the five constraints | from the dump's TOC, with `pg_restore -L` (only those five entries) and `--exit-on-error` | exit 0; all five present, `convalidated = t` (PostgreSQL checked every row at creation) |
| E. Restore again | dump of the repaired copy (711,453 bytes), restored into a fresh database with `pg_restore --exit-on-error` | **exit 0: no error, every constraint created** |
| D. Integrity | `fk-audit.mjs` (strict, read-only) on that restored database | **PASS all 175 foreign keys hold** |
| F. Refuses when the data differs | the repair run a second time on the repaired copy | refused: "orphan counts changed since the audit: expected {...15...}, found {...0...}"; rolled back |
| G. Rollback | the archive reloaded into a copy of the repaired database (replica, then `\copy`) | the original state returns exactly: 15 / 3 / 10 / 9 / 155 |

## Second rehearsal, with the script revised after the independent review (WO-INFRA-014)

**What changed in the script:** the parent rows (devices, notifications, delivery attempts) are now
deleted with **triggers on**, and step 4 checks **every** foreign key touching the five tables. The
fresh copy came from the same recovery point (`logs/reverify-after-review.log`).

| Step | Result |
|---|---|
| Restore as it is | 5 errors, as before |
| **Fault:** a table referencing an orphaned device, unknown to the script | **raised** `violates foreign key constraint "zz_dev_ref_device_id_fkey"`; rolled back, with all 15 devices and 155 attempts untouched |
| Clean run | `COMMIT`, 192 rows removed |
| Re-add the five constraints | exit 0 |
| Restore of the repaired dump, `--exit-on-error` | exit 0 |
| `fk-audit`, strict | **PASS all 175 foreign keys hold** |

**Conclusion:** the procedure turns the development database into one whose dump restores with every
foreign key created and validated, with no constraint missing or accepted silently. It refuses when the
data is not what the audit found, and it is fully reversible from its archive. **It was not run on the
development database:** that needs the founder's approval.
