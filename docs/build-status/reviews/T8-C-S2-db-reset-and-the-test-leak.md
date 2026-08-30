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
