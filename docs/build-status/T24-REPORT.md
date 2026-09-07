# T24 REPORT - A URL

**Order:** T24 - "A URL"
**Phases 1, 2 and 3 complete. Phase 4 PARKED -- there are no hosting credentials.**
**No URL exists. The acceptance test for this order was not met.**

---

## The answer first

**The order's own acceptance test is the one thing that did not happen.** S5.1 is
unambiguous: *"Not that the service starts. That a person signs in."* Nobody signed
in, because nothing is deployed, because applying `ops/render.yaml` needs a Render
account and this machine has none -- no `RENDER_API_KEY`, no `render` CLI, no
`~/.render`, and no Cloudflare or R2 credential either. **A database connection
string is not a hosting account.**

What T24 did instead is everything that stands between the schema and that URL,
and the honest summary is that **two of the three "never been done anywhere"
items are now done, on a real managed provider, as a non-superuser.**

| | |
|---|---|
| **Phase 1** | v1.19 installed; three runbooks corrected; four findings |
| **Phase 2** | `worker:install` **runs clean**; a job **proven to have acted**; the 21-job probe **could not run** and was not faked |
| **Phase 3** | The operator grant seeded, executed on Render, and **proven to unblock identity review** |
| **Phase 4** | **PARKED.** No credentials. Not simulated |

**Six findings, and the two that matter are about the test harness rather than
the product.**

| | |
|---|---|
| **D-307** | **The API test suite cannot run against a managed provider.** `SET session_replication_role = replica` is superuser-only and sits in `afterAll` in four spec files. This blocked Phase 2's 21-job probe, and it is not worked around |
| **D-306** | `jobs.worker_heartbeat` is owned by whoever ran the migration -- **locally that is the superuser**, which is D-50's first half |
| **D-301** | **v1.19 contradicts itself** on the GUC, in the revision that withdraws the ruling. Transcribed verbatim rather than silently fixed |
| **D-303** | **None of the seventeen project skills is loaded** -- the session started one directory above the clone |
| **D-304** | The appendix gate pinned the document filename and went red on install |
| **D-302** | The spec router cites four superseded revisions while its own protocol forbids exactly that |

---

## Phase 1 - install, and fix what a deploy reads

**ADU-DB-01 v1.19 installed**, superseding v1.16. v1.17 and v1.18 were never
installed and v1.18 must not be -- it rules `'set'` alone, which the four-run
table in the document that supersedes it refutes. `GOVERNED`,
`DOCUMENT_AUTHORITY.md` and `docs/amendments/README.md` all advanced in the same
commit; v1.16 moved to `docs/superseded/`.

### The three runbooks, and what each was wrong about

**All three now carry the five-line contract verbatim.** Duplicated rather than
referenced, deliberately: it is five lines, a pointer is a second place to go
stale, and `run-probe.md` had already gone stale about `db:check`.

| | |
|---|---|
| **`deploy.md`** | Had **no `GRANT CREATE ON SCHEMA public`**. PostgreSQL 15 revoked `PUBLIC`'s CREATE on schema `public`, and CREATE on the DATABASE is a different privilege -- so a deploy stops on node-pg-migrate's own tracking table **before `0001` is read** |
| **`staging.md`** | Step 3 let the first deploy create the roles and was **right by accident**. Now a prohibition with its reason attached |
| **`run-probe.md`** | Line 61's precondition was wrong, and its step-3 row claimed `db:check` prints "0 checks present (pre-v1.7)". It printed **16 PASS** |

### The prohibition, quoted

> **Do NOT pre-create the five roles. `0001` must.**
>
> `createrole_self_grant` grants membership only in roles **the role itself
> creates**, and `0001:60-62` guards creation with `IF NOT EXISTS`. Pre-provision
> them and **`adulis_migrate` creates nothing, receives nothing, and holds zero
> membership in the other five.**
>
> **The GUC stays set. It stays visible in `SHOW`. It grants nothing.**

The reason travels with it because the failure shape demands it: an earlier
version read as a *sequencing convenience*, so the obvious tidy-up is to
provision all six roles together up front -- and that tidy-up breaks the deploy
silently. **A step whose correctness depends on nobody doing the obvious thing
will eventually be done.**

D-298's circularity is closed by the same fact: `adulis_migrate` exists before the
first deploy, so `DATABASE_URL_MIGRATE` has a value at step 1.

### D-301 -- and I nearly made it worse

v1.19's S0.1 item D withdraws v1.18's `'set'`-alone ruling, and S4.4b.1's table
shows `set` alone failing. **S4.4b's opening still prints the withdrawn ruling as
live**, four paragraphs apart, with no marker saying which governs.

**A first draft of the transcription "helpfully" rewrote that block** to say
`'set, inherit'`. That would have made the installed document disagree with the
one the founder signed, in a section about privilege, in a way no gate could see.
**Reverted before commit.** The document is transcribed verbatim, contradiction
included, and the contradiction is registered.

**The three runbooks carry the correct value**, which is what a deploy actually
reads, so the document's internal disagreement does not reach an operator.

---

## Phase 2 - `worker:install`

### It runs clean, and the order predicted otherwise

```
worker schema installed: 6 tables in schema jobs, granted to adulis_jobs
```

Exit 0, as `adulis_migrate` with `rolsuper=f`. **No privilege finding, and no
grant beyond the five-line contract.** S3 said *"Expect a privilege finding...
this is the first time this installer has met a non-superuser."* It did not
produce one, and a predicted negative is worth recording so the next reader does
not go hunting for a grant that is not needed.

**It passes for a reason rather than by luck.** graphile-worker's
`create schema if not exists jobs` needs CREATE on the DATABASE (line 2); creating
tables inside schema `jobs`, which `0001` gave to `adulis_jobs`, needs CREATE on
that schema, which arrives because `adulis_migrate` **inherits** `adulis_jobs`;
and `ALTER ... OWNER TO adulis_jobs` needs **SET ROLE** membership in the new
owner. **Both halves of the GUC are load-bearing here for the same two reasons
they are load-bearing in `0001`.**

### A job was enqueued, taken, and proven to have ACTED

```
before: 0 heartbeat row(s)
enqueued: 1 job(s) waiting
Completed task 3 (prove_heartbeat, 102.00ms) with success
after:  1 heartbeat row(s)   beat_at = 2026-09-04T22:57:42.862Z
queue drained: 0 job(s) left
```

**Four things are proven and only the first is usually checked**: the enqueue
succeeded as `adulis_jobs`; a real worker **connected and took the job** as that
role; the job's own statement **committed a row**; and the queue drained. That
last one matters -- a failing job retries twenty-five times and still logs
"connected".

The first attempt failed on `null value in column "worker_id"` -- a NOT NULL
violation, **not a permission denial**, which is itself evidence that the grant
was fine and my probe's statement was not.

### D-307 -- the 21-job probe could not run, and I did not work around it

```
error: permission denied to set parameter "session_replication_role"
```

`SET session_replication_role = replica` suppresses constraint triggers so fixture
rows can be deleted regardless of foreign-key order. **It is superuser-only**, and
it sits in `afterAll` in `e2-e6.jobs`, `c1-onboarding`, `c2-catalogue` and
`c3-orders`.

**So the suite is not re-runnable on a managed provider, which is worse than not
running.** The first attempt left its fixture markets behind; the second failed in
`beforeAll` with `duplicate key value violates unique constraint "market_pkey"` --
a confusing error two layers from its cause.

**And the deletes genuinely need it.** Running the extracted teardown by hand as
`adulis_migrate`: **4 of 35 DELETE statements succeeded** and both fixture markets
survived. The parameter is not defensive tidiness.

This is ADU-DB-01 v1.19 S4.4b.4's sentence reaching the test harness: *"the
environment every gate runs in makes the failing checks unreachable."* The fix is
a change to how every fixture in this repository is cleaned up, and inventing one
mid-order is exactly what the closing instruction forbids.

*Separately, and not a privilege issue:* the probe also exceeds jest's 5 s default
running twenty-one jobs over a transatlantic link. `--testTimeout` covers that.
Recorded so the two are not confused by whoever reads the first failure.

### D-306 -- ownership, and the local case is the one that matters

Schema `jobs` is owned by `adulis_jobs`. **`jobs.worker_heartbeat` is not.**

| | |
|---|---|
| **local** | owner = `adulis_bootstrap` -- **the superuser** |
| **Render** | owner = `adulis_migrate` |

D-49 is explicit: *"every table is owned by its schema's owner, not by whoever ran
the migration."* `0026` creates this one with no `ALTER ... OWNER TO`, so it lands
on the executor and the two environments disagree about who that is.

**It works because `0026:154` grants the three privileges explicitly** -- a rule
held by a grant instead of by ownership, which holds until somebody adds a
statement the grant does not cover. D-50 was a definer function owned by a
superuser; this is that first half, with the second half absent only because
nobody has written one yet.

Not patched: **a merged migration is never edited.** And the more valuable
observation is that **Appendix C has no check for D-49 at all** -- check 10
asserts the definer class, nothing asserts table ownership, and that query is one
line.

---

## Phase 3 - the operator grant

**Two answers for two places**, as the order rules.

**Non-production seeds it.** `seed.mjs` grants `ADMIN` to the already-seeded
account -- which invents nothing, because that account is created two hundred
lines above and is the one the console e2e signs in as. **A seed that cannot
publish a seller is a seed that cannot test the product.** `ADMIN` here and
nowhere else: a real grant takes the narrowest role, because the access log
records every decision against whatever role was held; a fixture has no log
anyone reads and needs claim review and moderation too.

**Production stays hand-run.** E4 is untouched.

**This laptop now has an operator.** `NODE_ENV=test pnpm db:reset` passes and the
grant is there, `granted_by_account_id` NULL -- which the schema permits for
exactly this case, because the first grant has nobody above it. D-294 found this
machine had none after twenty-three orders.

### On Render, and the grant was proven to DO something

The runbook's steps 1, 3 and 4 executed verbatim as `adulis_migrate` with
`rolsuper=f`. **The statement that worked is the runbook's own, unmodified.**

An `INSERT` succeeding does not establish that the grant matters. Calling
`verification.read_attestation` as `adulis_app`:

| call | result |
|---|---|
| as the **granted** operator | returns; no raise |
| as an account with **no grant** | `ERROR: no grant permits reading an identity attestation` |
| `adulis_app` SELECTing the log directly | `ERROR: permission denied for table access_log` |

The first two are **D-294's chain, closed and shown to fail closed.** The third is
**Appendix C check 10's invariant holding on a managed provider for the first
time** -- until now it had only ever been asserted under a superuser, where it
returns zero rows because privileges are *irrelevant* rather than correct.

**Two substitutions, stated rather than glossed.** The account was inserted by
hand because **no API is deployed to sign anyone in** -- that is Phase 4, and the
runbook's step 1 says explicitly to *stop* when the account does not exist rather
than create one. So this tested the runbook's statements and the privilege model
beneath them; **it did not test step 1, and it was not a founder who signed in.**
And the market row needed `sms_primary_provider` before it would accept
`otp_enabled = true` -- `market_otp_requires_route` refused it, the schema
declining to describe a market that can issue an OTP it has no way to send.

---

## Phase 4 - PARKED

**No hosting credentials exist on this machine.** Searched: `RENDER_API_KEY`,
`RENDER_TOKEN`, `~/.render`, the `render` CLI, `wrangler`, and every environment
variable matching render/cloudflare/r2 -- **zero matches.** The three connection
strings supplied across T23 and T24 are database URLs; none of them can create a
service.

**Nothing was simulated.** `ops/render.yaml` still says `THIS FILE HAS NEVER BEEN
APPLIED`, which remains true.

**And S5.1's acceptance test is not merely blocked on credentials.** It requires a
person to sign in *in a browser, from a machine that is not the one that built
it*. That is not something an agent can do at all, and it should not be reported
as anything other than outstanding.

What is ready for the day the account exists: the blueprint and its gate, the
five-line contract in three runbooks, `NODE_ENV=staging` in the closed set with
its guard audit, the environment banner served from `/v1/bootstrap`,
`TRUSTED_PROXY_HOPS` as a validated count, and CSP/CORS derived from
configuration -- all landed in T23 and unchanged here.

---

## WORK ORDER T24 REPORT

```
Phase 1  v1.19 installed, authority docs advanced: YES
         deploy.md, staging.md, run-probe.md corrected: YES / YES / YES
         the prohibition carries its reason:
           "Do NOT pre-create the five roles. 0001 must. createrole_self_grant
            grants membership only in roles the role ITSELF creates, and
            0001:60-62 guards creation with IF NOT EXISTS. The GUC stays set.
            It stays visible in SHOW. It grants nothing."
Phase 2  worker:install run against Render:
           DATABASE_URL_MIGRATE=... node ops/scripts/install-worker-schema.mjs
           -> exit 0, "6 tables in schema jobs, granted to adulis_jobs"
         privileges needed beyond the five-line contract: NONE
         a job enqueued, taken, and PROVEN to have acted:
           JOBS_URL=... MIGRATE_URL=... node provejob.mjs
           -> before 0 rows / Completed task 3 (102.00ms) / after 1 row /
              queue drained 0
         all 21 jobs probed as adulis_jobs on the deployed instance: 0/21
           BLOCKED by D-307 -- session_replication_role is superuser-only and
           the suite's afterAll needs it. NOT worked around.
Phase 3  founder grant seeded in non-production:
           NODE_ENV=test pnpm db:reset  -> PASS, one live ADMIN grant
         grant-founder-operator.md executed on the instance:
           INSERT INTO core.operator_grant
             (id, account_id, role, granted_by_account_id, reason)
           VALUES (gen_random_uuid(), '<account id>', 'IDENTITY_REVIEWER',
                   NULL, 'Founder operator, T24 Phase 3. Identity review for
                   the beta cohort.');
           -- the runbook's own statement, unmodified. Proven to work by
              read_attestation succeeding for the grantee and raising for a
              non-grantee.
Phase 4  render.yaml applied: NO -- PARKED, no hosting credentials
         NODE_ENV=staging asserted at boot: not run (needs the deploy)
         banner visible: not confirmed (needs the deploy)
         TRUSTED_PROXY_HOPS: not set from a topology that does not exist
         CSP and CORS derived from config: YES, landed T23 (D-291), unchanged
         evidence/raw expiry on the real bucket: NO -- no R2 credentials
Phase 4a A PERSON SIGNED IN ON THE DEPLOYED INSTANCE: NO
         a seller reached a published product: NO
Gates    4 document gates: node ops/scripts/gates.mjs --only
           docs-ascii,transcription,appendix,surface-markers  -> 4/4 PASS
         db:reset (local, with the new seed): NODE_ENV=test node
           --env-file-if-exists=.env ops/scripts/db-reset.mjs -> PASS
         Full ci:local NOT re-run this order -- boot-smoke is red on this
           machine for D-293's msedge reason and D-296's 429 is 1-in-3.
Register 9 new -- D-301 through D-309. BLOCKERs first: D-307 (the API suite
         cannot run on a managed provider), D-306 (ownership vs D-49).
Parked   Phase 4 in full -- needs a Render account and R2 credentials.
         Phase 4a -- needs a person and a second machine; not an agent task.
         The 21-job probe -- needs D-307's ruling.
State of main: 4bec441 (PR #88) -- everything since T22 Phase 2 is unmerged.
         T22 p2-p5 + report (PR #93), T23 phases 2-5 (PRs #94-#97), and T24
         phases 1-3 all stack above it.
```

---

## What needs you

1. **Merge the stack, oldest first.** `main` is still at T22 Phase 1. Thirteen
   phases of work sit above it in one chain, and every T24 branch is on top.
2. **D-307's ruling: how do fixtures get cleaned up on a host that will not grant
   superuser?** It decides whether the API suite can ever run against a real
   provider -- which is the only place any of this family of findings has ever
   surfaced.
3. **A Render account and R2 credentials**, which is the whole of Phase 4. Until
   then `ops/render.yaml` is configuration that has never met a server, and the
   first line of the file still says so.
4. **D-301's one-line correction** to v1.19 S4.4b at the next revision -- delete
   or mark the withdrawn v1.18 block.
5. **Start the session in the repository**, not one directory above it (D-303).
   Seventeen project skills exist and none of them loaded for this order.
6. **A D-49 check in Appendix C**, which is one query and would have found D-306
   in Tier 2.
