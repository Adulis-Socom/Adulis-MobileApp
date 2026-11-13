# WO-INFRA-013 -- Repair plan (development database)

**Live repair: BLOCKED.** It needs the founder's separate, explicit approval. Nothing here was run on the
development database.

## The choice per orphan category

| Category | A: restore the parent | B: reassign the child | C: remove a confirmed fixture record | D: archive pending investigation | Chosen |
|---|---|---|---|---|---|
| 15 devices on market `cccc6666-...` | No: inventing a market | No: no evidence of the right market | yes: `c6-accounts` fixture market; nothing references the devices | yes | **D then C** |
| 3 notifications to account `26262626-...-030` | No: inventing an account | No | yes: `t26` fixture account | yes | **D then C** |
| 10 order transitions | No: the orders' content is gone | No | yes: children of teardown-deleted test orders | yes | **D then C** |
| 9 claim evidence items | No | No | yes: children of teardown-deleted test claims | yes | **D then C** |
| 155 OTP delivery attempts | No | No | yes: delivery records of deleted test challenges (2026-11-09) | yes | **D then C** |

**No parent is invented and no child is reassigned:** the evidence supports neither. Every removed row is
first exported (D), so nothing is lost even if a row later proves useful.

## What would change

| Table | Rows removed | Rows changed | Data loss |
|---|---|---|---|
| `core.device` | 15 | 0 | none of value; archived |
| `core.notification` | 3 | 0 | archived |
| `core.order_state_transition` | 10 | 0 | archived |
| `core.claim_evidence_item` | 9 | 0 | archived |
| `core.otp_delivery_attempt` | 155 | 0 | archived |
| everything else | 0 | 0 | -- |

**Why it is necessary:** while these rows exist, any dump of the development database restores with five
foreign keys missing, the database contradicts its own validated constraints, and the suites that read
those tables can see rows that should not exist.

## Live procedure (after approval), Git Bash on the development machine

```
# 0. Writers stopped (API, console). Recovery point: a fresh dump, checksummed.
R=G:/AdulisDevelopment/db-repair-$(date -u +%Y%m%dT%H%M%SZ); mkdir -p $R
docker exec adulis-postgres pg_dump -U adulis_bootstrap -Fc -d adulis > $R/adulis-before.dump
(cd $R && sha256sum adulis-before.dump > SHA256SUMS.txt)

# 1. Confirm the audit still matches the script's expected counts (15/3/10/9/155):
node --env-file=.env ops/scripts/fk-audit.mjs

# 2. Archive the 192 rows (read-only export), one CSV per table, as rehearsed (step A):
export MSYS_NO_PATHCONV=1
while IFS='|' read -r t q; do
  docker exec -e PGOPTIONS='-c default_transaction_read_only=on' adulis-postgres \
    psql -U adulis_bootstrap -d adulis -X -c "\\copy ($q) TO STDOUT CSV HEADER" > $R/archive-$t.csv
  echo "$t: $(( $(wc -l < $R/archive-$t.csv) - 1 )) rows"
done <<'EOF'
device|SELECT d.* FROM core.device d WHERE NOT EXISTS (SELECT 1 FROM core.market m WHERE m.id=d.market_id)
notification|SELECT n.* FROM core.notification n WHERE NOT EXISTS (SELECT 1 FROM core.account a WHERE a.id=n.recipient_account_id)
order_state_transition|SELECT t.* FROM core.order_state_transition t WHERE NOT EXISTS (SELECT 1 FROM core."order" o WHERE o.id=t.order_id)
claim_evidence_item|SELECT e.* FROM core.claim_evidence_item e WHERE NOT EXISTS (SELECT 1 FROM core.claim c WHERE c.id=e.claim_id)
otp_delivery_attempt|SELECT a.* FROM core.otp_delivery_attempt a WHERE NOT EXISTS (SELECT 1 FROM core.otp_challenge c WHERE c.id=a.otp_challenge_id)
EOF
(cd $R && sha256sum archive-*.csv >> SHA256SUMS.txt)          # expect 15, 3, 10, 9, 155

# 3. The repair: one transaction; any unexpected count or leftover rolls everything back.
docker exec -i adulis-postgres psql -U adulis_bootstrap -d adulis -X -v ON_ERROR_STOP=1 < docs/infrastructure/WO-INFRA-013-repair.sql

# 4. Verify: every foreign key holds (strict, read-only), and a dump restores cleanly.
node --env-file=.env ops/scripts/fk-audit.mjs                       # expect: PASS all 175 foreign keys hold
docker exec adulis-postgres pg_dump -U adulis_bootstrap -Fc -d adulis > $R/adulis-after.dump
#    then restore adulis-after.dump into a disposable PostgreSQL with pg_restore --exit-on-error (exit 0).
```

**What proves success:**
- the script's own final check (an orphan raises and rolls back);
- `fk-audit`: `PASS all 175 foreign keys hold`;
- the after-dump restores with `--exit-on-error`.

## Restoring the previous state

| Situation | How |
|---|---|
| The script failed | nothing to do: it is one transaction and rolled back |
| A removed row is wanted back | re-insert it from its CSV: `SET session_replication_role = replica;` then `\copy core.<table> FROM '<csv>' CSV HEADER` (rehearsed: the archive restores exactly 15/3/10/9/155) |
| Everything back | restore `adulis-before.dump` into a new database and swap, or `pg_restore --clean` into `adulis` (stop writers first) |

## Remaining risks
- **The counts must still match.** If any suite ran against the development database after 13 November,
  the counts differ and the script refuses. Re-audit, then update the expected counts with evidence.
  Since WO-INFRA-012 the suites refuse that database, so this should not happen.
- **One deliberate trigger bypass.** The script bypasses `trg_append_only` on two tables for its own
  transaction only. It is the same mechanism that caused the orphans, used here on rows already proven
  to have no dependents.
