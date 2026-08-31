# Adversarial pass -- T8-C S2

**Ran against:** 719f448 (`tier8/t8c-db-reset`), the whole diff against `main`.
**Performed by:** the building agent, per WORK ORDER T7 S0 -- "the second
opinion is your own adversarial pass, and it is not optional."
**Written before** the fixes it prompted. The commit that applies them cites
this file.

The premise of the pass: this section added a script whose entire job is
destruction, and a claim about what the script guarantees. Both were written
by the same person in the same hour, which is the condition under which a
false claim is easiest to make and hardest to notice.

---

## F1 -- MAJOR -- `db:reset` prints PASS unconditionally, and two documents say it checks

`ops/scripts/db-reset.mjs:164` prints

```
PASS  the database is what migrate, worker:install and seed give on a fresh clone.
```

after printing the row counts. Nothing reads the counts. The seed could
produce zero markets, or the migrate step could leave a partially-built
schema that still answers `count(*)`, and the line prints all the same.

That is not a cosmetic problem, because two artifacts already assert the
check exists:

- the README: "It prints the row counts before and after **and fails if the
  result is not what a fresh clone gives**."
- the S2 commit message, same claim.

So the repository documents a verification that was never written. This is
the defect T8-C S1 spent its whole section attacking, arriving one section
later by a different door: a green that does not depend on the thing it
names. S1's finding was a comparator that asserted two forms agree without
asserting what they agree about; this is a PASS that asserts nothing at all.

**Verdict: CONFIRMED by reading, and by construction** -- there is no branch
in the file between the counts and the print.

## F2 -- MAJOR -- the reset picks the permissive default when NODE_ENV is unset

`db-reset.mjs:49` refuses `NODE_ENV === 'production'` and nothing else. Unset
proceeds. `staging` proceeds. `prod` proceeds.

D-105 -- the finding this entire work order was raised to fix, stated in
ADU-RUL-03 S1 -- is that "a service that cannot determine its environment
must not pick the permissive default", and the API now refuses to boot on an
unset `NODE_ENV`. A destructive script written inside that order commits the
same defect it was written to eliminate.

The host allow-list is a second guard and it is the stronger one, so the
exposure is small in practice. That is a reason to fix this cheaply, not a
reason to leave it: the guard whose absence is survivable is exactly the one
that gets copied into the next script.

**Verdict: CONFIRMED.**

## F3 -- MINOR -- `before:` and `after:` count different things under paired labels

`before:` prints table counts (`119 table(s) across 10 schema(s)`); `after:`
prints row counts (`markets 1, accounts 1, ...`). They read as a pair and
are not one. The number that matters for D-128 -- 180 markets before, 1
after -- is not what the script printed, and had to be gathered by hand for
the register entry.

**Verdict: CONFIRMED.**

## F4 -- MINOR -- DATABASE_URL_JOBS set without a password silently gets the app's

`db-reset.mjs:131` falls back to `DATABASE_URL`'s password whenever
`passwordFrom(DATABASE_URL_JOBS)` is null -- which includes the case where
`DATABASE_URL_JOBS` is set and simply has no password in it. The reset then
gives `adulis_jobs` a password that matches nothing the worker will use, and
the failure surfaces later as a worker that cannot connect. The fallback is
right when the variable is absent and wrong when it is present.

**Verdict: CONFIRMED.**

## F5 -- LIMITATION, not a defect -- the host guard cannot see a tunnel

The header says the local-host check is "the only thing between it and a
database somebody cares about". A port-forward to production presents as
`localhost:5432` and passes. The guard is worth keeping and the sentence
overstates it; a comment that overstates a guard is how the next reader
decides the guard is sufficient.

**Verdict: CONFIRMED as an overstatement. No code change.**

---

## Checked and found sound

- **`DROP SCHEMA ${s} CASCADE` interpolates.** `SCHEMAS` is a module-level
  literal of ten constants; no caller supplies it. Not injectable.
- **The password is never logged.** `ALTER ROLE` is issued through the pg
  client, not through a shelled-out `psql`, and no line prints `pw`.
- **The teardown's `session_replication_role = replica` is scoped.** It is
  set on one pooled connection and reset in `finally`, and the connection is
  released after. It does not leak to other tests: `SET` without `LOCAL` is
  session-scoped, and the session ends at `release()`.
- **The teardown deletes by id, not by name.** `DELETE FROM core.market
  WHERE display_name = 'Race'` would have taken the 179 historical rows too,
  which is the right outcome by luck and the wrong rule to write: a suite
  deletes what it created.
- **`--env-file-if-exists` rather than `--env-file`.** CI has no `.env`;
  `--env-file` would fail every properly-configured machine. This is the
  reasoning `install-worker-schema.mjs` already carries.

---

# Second round -- run against 99c49a6, after the first round's fixes

Fifteen agents re-read this branch under a refute-by-default protocol: a
finding survived only if every verifier independently failed to refute it.
Three survived here.

## R1 -- BLOCKER -- the teardown left the row a trigger made for the seller

`core.seller_public_stats.seller_id` is `uuid PRIMARY KEY REFERENCES
core.seller(id)` with no `ON DELETE` (0010:155-156), and
`trg_create_public_stats` (0010:191) writes one row per seller AFTER INSERT.

`session_replication_role = replica` suppresses the foreign key's
referential-integrity triggers along with the append-only one -- so
`DELETE FROM core.seller` succeeded and left the stats row pointing at
nothing.

**Verified independently before acting on it**, by querying every one of the
98 single-column foreign keys into `core.seller/account/market/product/
product_variant` for rows whose parent is gone. Exactly one orphan, in
`seller_public_stats`.

The first teardown did not close D-128's leak so much as change its shape:
from a tree of live rows to one orphan per run, in a table read on every
storefront page load. Worse in one respect -- a leaked market is visible as a
market; an orphaned stats row is visible only to a query nobody runs.

**Verdict: CONFIRMED and FIXED** (D-134). Proven by measurement: orphan
cleared, suite 25/25, count stayed at 0 where it had grown by one per run.

## R2 -- MINOR -- two comments said the opposite of what the file now does

Lines 295-297 still read "it cannot delete the stock events it made, because
they are append-only. It uses a variant of its own and leaves it", and line
303 "The fixture is small and left behind deliberately" -- four lines from an
`afterAll` that deletes exactly those stock events.

Two reviewers raised this independently, and both landed on the same reason
it matters: the surviving text is not merely stale, it is the justification a
later reader would use to remove the `replica` line as an unnecessary
sledgehammer, or to reinstate fixed fixture ids. **Verdict: CONFIRMED and
FIXED.**

## R3 -- MAJOR, pre-existing -- market deletes under replica orphan devices

Ten suites end with `DELETE FROM core.market` under `replica`.
`core.device.market_id` references it. Measured: **6 orphaned device rows
before a full run, 9 after** -- three per run.

This corrects D-128, which recorded those three rows as harmless residue.
They are not merely unclaimed; they point at markets that no longer exist.
**Verdict: CONFIRMED, recorded as D-135, not fixed here** -- the fix is an
untested edit to ten suites this branch does not otherwise touch.

## Refuted, and worth recording as refuted

Twelve further findings were raised and did not survive. Three are worth
naming because they look right:

- *"the replica setting leaks to other tests"* -- refuted: `SET` without
  `LOCAL` is session-scoped, the connection is released in `finally`, and no
  other test observes it.
- *"`DATABASE_URL_MIGRATE` fails on a virgin volume because `adulis_migrate`
  has no LOGIN"* -- true of the repository, and not a defect of this PR:
  nothing in the diff causes, introduces or worsens it.
- *"db:reset's host allow-list can be defeated"* -- only by a port-forward,
  which the header already says in as many words.

## One unexplained red

A full `pnpm --filter @adulis/api test` run exited 1 during this round
**without its output being captured**, and three consecutive runs
immediately after passed 459/459. The failing test is therefore not named
here, because it is not known. It is recorded rather than omitted: D-124's
class (shared rate-limit buckets) is the standing candidate, and an
intermittent red that nobody writes down is one nobody looks for.
