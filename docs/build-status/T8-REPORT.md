# WORK ORDER T8 REPORT

**Written at T8-R, after Phases 1-4 and before Phases 5-6.** Not written phase by
phase as the work happened -- T8 had no report until T8-R asked for one -- but
written by the agent that did the work, from its own commits, days old. Nothing
here is reconstructed from a stranger's log.

**Every claim below names what produced it** (ADU-RUL-03 S5.1). Where a number
cannot be produced on demand, it says so instead of estimating.

```
WORK ORDER T8 REPORT
Phase 1  console.* lint fires:  npx eslint apps/api/src/common/_t8_probe.ts (planted
                                console.warn) -> "2:3  error  Unexpected console
                                statement  no-console", probe removed
         NODE_ENV asserted at boot:  NODE_ENV unset  -> node dist/main.js exits 1,
                                "NODE_ENV is not set. This process refuses to start"
                                NODE_ENV=staging -> exits 1, "not one of"
         existing NODE_ENV guards re-read: 5 - inverted 1 (the [FAKE SMS] print,
                                rewritten) - parked 0 - deliberately left outside the
                                boundary 3 (ops .mjs scripts, separate processes). D-107
Phase 2  fresh browser reaches sign-in unconfigured:  headless Edge (msedge
                                --headless=new --dump-dom) against the built console on
                                the console origin -> sign-in renders; DOM contains
                                "Phone number", "Send me a code", id="signin-phone"
         one row per browser:   same profile twice -> 1 core.device row; a second
                                profile -> 2; the first profile returning -> still 2
                                (SELECT count(*) FROM core.device WHERE platform='WEB')
         cookie flags:          Set-Cookie asserted in t8-device-bootstrap.e2e.spec.ts:
                                HttpOnly, Secure, SameSite=Strict, Path=/, no Domain
Phase 3  is_live outside bootstrap:  t8-market-from-device.e2e.spec.ts asserts
                                structurally that auth.service, otp.service,
                                auth.controller and deletion.controller contain neither
                                "is_live" nor "core.market" outside comments. Repo-wide
                                the only remaining reads are bootstrap.controller.ts:95
                                and orders.service.ts:71 (the latter is D-116)
         two-live-market suite: t8-market-from-device.e2e.spec.ts creates TWO live
                                markets and asserts a new account lands in the one its
                                DEVICE was placed in, not the earlier-created one
Phase 4  declaration required:  t8-market-from-device.e2e.spec.ts -- verify without it
                                -> 400 slots.path=age_declared_over_18 and no account
                                row; with it -> 200, age_declared_over_18=true and
                                age_declared_at not null; and the CONSOLE shape
                                (cookie device, no device_id) end to end
         MT-KEYS regenerated and gated:  pnpm verify:mt-keys -- proven to fail on a
                                deleted manifest line, on an Amharic value in a
                                HUMAN-REQUIRED key, and on a REMOVED marker (the attack
                                that defeated its first version, D-121)
Phase 5  gate 20 proven by reintroducing the throw:  NOT STARTED
Phase 6  C-2 reached: NO        seeded seller signs in: not attempted this order
                                idle warning: not attempted this order
Gates    db:check   pnpm db:check -> "16 PASS - 0 PENDING - 0 FAIL"
         tests      npx jest (apps/api) -> "459 passed, 459 total" on the Phase 4
                    branch. On MAIN the same command failed two tests on the first
                    run and gave "455 passed, 455 total" after purging the two OTP
                    rate-limit buckets -- shared-bucket contention between parallel
                    suites, intermittent, invisible to CI, fixed on the Phase 4
                    branch. D-124
         determinism  pnpm db:determinism, run inside pnpm ci:local
         ci:local   pnpm ci:local -> "PASS  all 20 gates" on the Phase 4 branch, twice
                    consecutively; "PASS  all 19 gates" on main (the 20th, mt-keys,
                    lands with Phase 4)
Register 20 new (D-105..D-124) -- no BLOCKERs; MAJORs first (S-Register below)
Parked   (S-Parked below, each with the ruling it needs)
State of main: 9fad3d7 (PR #27, Phase 3) -- Phase 4 is PR #28, green and UNMERGED;
         D-119..D-122 and gate 20 exist only on that branch. Phases 5 and 6 are
         not started. This report and the reviews directory are a separate PR.
```

---

## The review model, as exercised

Every phase ran CI's gates plus an adversarial pass before merge, and the passes
are the review of record (T7 S0). **Their findings are in the tree; their
reasoning mostly is not** -- no review was ever committed until T8-R, which is
D-123. Four T7 reviews were recovered verbatim from surviving run artifacts and
the rest are stubs; `docs/build-status/reviews/README.md` says which is which.

What the passes found in T8, in one line each:

- **Phase 1** -- no pass completed here. Two findings were relayed from #25's
  review and applied in Phase 2; one of them turned out to be unsound.
- **Phase 2** -- "do not merge". The blocker was mine: sign-in failed at step
  one because the anonymous idempotency actor still demanded the header the
  phase had just stopped the console from sending, and every test passed
  because every test still sent it.
- **Phase 2, fixes** -- a skeptic pass over my repairs found two of them wrong,
  including a 500 I had closed at one door and re-opened at another.
- **Phase 3** -- a security regression I introduced: the new refusal made three
  public endpoints into account-enumeration oracles.
- **Phase 4** -- the gate the phase exists to add could be defeated by deleting
  one comment.

## Phase 1 -- D-105, the guard that was never armed (PR #25, merged b2a6ead)

`console.*` is banned in `apps/api` by lint, because Pino's allow-list emits a
field BECAUSE it is named and `console.warn` is governed by nothing -- so
ADU-CON-02 S20.2's guarantee held only for code that used the logger. Two
exemptions live in the rule rather than as disable comments: the contract
generator and the load-test harness, neither of which serves a request.

`NODE_ENV` is asserted at a boundary. `common/env.ts` reads it once, validates
it against a closed set, memoises it, and both entrypoints refuse to start
without it -- `worker.ts` as well as `main.ts`, because the worker is the same
codebase started differently and constructs the same adapters.

**The OTP had nowhere legitimate left to go, and that is D-106.** S13 asks for
it on the terminal; the ruling forbids the mechanism that put it there; and the
logger cannot carry it, because the code and the phone are on NEVER_LOG
precisely so they never reach a log line. Routing it through pino's `msg` would
satisfy the letter and launder the value. It goes to a gitignored development
file instead. Verified: zero six-digit codes and no phone number in the process
streams, the code in the file, the logger announcing only the path.

**D-107** records the sweep the ruling asked for: five runtime guards, all
re-read; the two inside the API process now sit behind the boundary, the three
in ops `.mjs` scripts deliberately do not.

## Phase 2 -- bootstrap mints the device (PR #26, merged cbafc96)

D-102 had two arms and neither worked. The server mints the row now, at
`/v1/bootstrap`, and returns the identity in an httpOnly `__Host-` cookie: the
row and the identifier are created by the same act, so an identifier cannot
exist without its row. `WEB` joins `core.device_platform` (0040, alone in its
file), which closes D-95 and owes ADU-DB-01 v1.13 the value (D-108).

Two surfaces, two mechanisms, told apart by `X-Adulis-Client` -- already
specified by ADU-API-01 S3 as always-sent and formatted `surface/version`, so
the signal is transcribed rather than invented. **A web request's
`X-Adulis-Device` is ignored outright**, and a test exists whose only job is to
prove a client-chosen id is neither honoured nor written.

**Verified in a real browser**, because S3.3 said to and because "`__Host-`
should work over http on localhost" had a *should* in it. Headless Edge, the
built console on the console origin: sign-in renders with no device
configuration, two loads in one profile produce one row, a second profile
produces a second, the first profile returning keeps its own.

What the reviews cost: the blocker above, plus a CONSOLE verify that never
checked the cookie's device was a WEB row or an unclaimed one, a malformed
cookie that 500'd an unauthenticated caller, unbounded anonymous minting, a
no-configuration branch that set no cookie at all, and -- from the skeptic pass
-- the same 500 re-opened one endpoint along and an ownership guard scoped by a
field the caller fills in.

## Phase 3 -- the market comes from the device (PR #27, merged 9fad3d7)

Both `WHERE is_live LIMIT 1` lookups are removed rather than ordered: an
`ORDER BY` would have made them deterministic and still wrong, deterministically
picking a market for a person nobody asked about. Identity creation reads the
market off the device row; the OTP timing lookup does the same where no account
exists yet.

**The pass found a security regression I had introduced.** My refusal depended
on whether the phone had an account, so `otp/resend` -- public, unthrottled --
answered 202 for a registered number and 400 for an unregistered one. ADU-AUTH-01
S22 forbids exactly that. The refusal looks at the caller's own device now and
never at the phone, and two tests assert a known and an unknown phone are
indistinguishable on every anonymous path.

**D-116** records that the ruling's "exactly one place a market is chosen" is
true of the auth path and not yet of the tree: the cart still chooses one.

## Phase 4 -- the age declaration (PR #28, OPEN and green)

D-101 made first-time sign-in impossible. Both sentences are transcribed
verbatim from ADU-RUL-03 S4. The control is shown to everyone (D-119), because
the console cannot know who is new without asking the server whether a phone is
registered -- the enumeration oracle S22 forbids.

`am.ts` carries the ENGLISH for both, marked HUMAN-REQUIRED, and MT-KEYS.md has
two lists: a gate above the work list. **The gate's first version could be
defeated by deleting one comment** (D-121); membership is pinned in the gate
now. **D-122**: it also repaired what it checked, so a re-run turned red green.

**What is not verified, and is not claimed** (D-120): the rendered control was
never observed. The declaration sits on the code step, which a headless page
load cannot reach. Verified instead: both sentences ship verbatim in the bundle,
the only initial state is false, the value is sent only when ticked, and the API
refuses without it and records `age_declared_at`.

## Phases 5 and 6 -- not started

**Phase 5** is the boot smoke test. One thing to settle first: T8 S5 calls it
"gate 20", and gate 20 is now `mt-keys` (Phase 4). The smoke test will be
**gate 21** unless you want them swapped. It is also worth knowing before it is
planned that this development database cannot currently complete a console
sign-in -- roughly 170 leftover markets, none live, and only the seeded one
carrying a `timing_config` (D-112).

**Phase 6** is console C-2, which needs Phases 2, 3 and 4 -- two merged, one
open.

---

## S-Register -- 20 new entries (D-105..D-124), no BLOCKERs, MAJORs first

```
MAJOR    D-105 NODE_ENV=production is set nowhere, so every guard on it was a
               no-op -- including T7 S3.2's own rule. Written late, at T8-R:
               the number was cited by ADU-RUL-03 and resolved to nothing
MAJOR    D-113 POST /v1/devices is the same unauthenticated unbounded write the
               mint limit closed, one endpoint along
MAJOR    D-114 no trust-proxy setting, so every IP-keyed bucket collapses to one
               subject for the whole deployment behind a CDN
MAJOR    D-121 the rule about what may not be machine-translated lived in the
               file machine translation edits
MAJOR    D-123 no adversarial review was ever committed, and the register cites
               their findings
QUESTION D-110 the idempotency key is still minted client-side, and Phase 2's
               grep says it should not be
QUESTION D-111 the device cookie rides SameSite alone on the pre-session request
QUESTION D-115 a device row is nameable by any MOBILE client; only WEB rows are
               now protected
MINOR    D-106 ADU-CON-02 S13's "prints OTPs to the terminal" is no longer
               implementable, and the deviation is recorded rather than kept
MINOR    D-107 every NODE_ENV guard re-read; one more was inverted the same way
MINOR    D-108 core.device_platform gains WEB; ADU-DB-01 v1.13 owes the value
MINOR    D-109 the seed no longer writes a device, and the ANDROID lie with it
MINOR    D-112 nothing seeds core.timing_config, so a freshly migrated database
               cannot complete a sign-in
MINOR    D-116 the cart still chooses a market, so "exactly one place" is not
               yet true of the tree
MINOR    D-117 a global-count assertion in the jobs suite failed an unrelated
               phase -- D-83's rule broken by a test relying on it
MINOR    D-118 the order "register, then bootstrap" is required and written
               nowhere
MINOR    D-119 the console cannot ask whether a phone is new, so the declaration
               is shown to everyone
MINOR    D-120 the rendered age control was not observed in a browser
MINOR    D-122 a gate that repairs what it checks turns red into green
MINOR    D-124 main's full local test run is intermittently red from shared
               rate-limit buckets; the fix is on the unmerged Phase 4 branch
```

**D-119..D-122 are on the Phase 4 branch, not on main.**

## S-Parked -- what needs a ruling, by entry

- **D-110**: confirm Phase 2's grep targets device IDENTITY minting only, or rule
  where idempotency keys come from if not the client.
- **D-111**: whether the Origin check extends to requests carrying only the
  device cookie, and what an absent Origin means on the anonymous bootstrap path.
- **D-113**: what budget `POST /v1/devices` carries, and per what subject -- IP
  is the only anonymous subject available and it is the wrong one behind a
  carrier NAT.
- **D-114**: the deployment topology, then `app.set('trust proxy', <n>)` with n
  named rather than `true`. Trusting one proxy too many lets a client forge its
  own bucket, which is worse than today. D-80 is the neighbouring gap.
- **D-115**: whether a MOBILE device id is an exclusive claim or a first-identity
  record, and if the latter, what stops a client naming a device it never held.
- **D-116**: whether cart creation reads the device's market too, or an anonymous
  cart is allowed a default market.
- **D-118**: state the order in ADU-API-01 S3 -- register, then bootstrap -- or
  rule that bootstrap may create an app device row on first sight.
- **D-106**: whether ADU-CON-02 v3.2 restates S13 as a development file.
- **D-112**: a deployment runbook step asserting timing_config is in force before
  a market opens would turn a confusing 500 into a refusal at the right moment.
- **Phase 5's gate number**: 20 is taken; the smoke test is 21 unless swapped.

---

# WORK ORDER T8-C REPORT

**Written as the work happened**, section by section, by the agent that did it
-- unlike the T8 block above, which says in its own first line that it was
assembled later. The distinction is the point of both sentences.

**Every claim below names what produced it** (ADU-RUL-03 S5.1). A number that
cannot be produced on demand is not printed.

```
WORK ORDER T8-C REPORT

S0  the register conflict     efd5c91 -- VERIFIED, not re-resolved
    entries in order          D-110..D-124, grep on main
    deleted lines vs parents  0 (686a30b) / 0 (ed9aee8)

S1  the two comparators       PR #30
    verify:deferred-values    EXPOSED -> pinned at 16 rows, plant re-run
    verify:permission-doc     NOT exposed -- RED on 8 checks under the same attack
    checks 14 and 16          NOT exposed -- expected side is the live database

S2  db:reset                  PR #31
    markets before/after      180 / 1
    devices before/after      458 / 0
    console sign-in completes headless Edge: bootstrap -> otp/request -> code
                              from apps/api/.dev-sms.log -> otp/verify ->
                              GET /v1/auth/sessions
                              = 200, current=true remembered=true
    full suite                459/459, from a shell with nothing exported
    residue after a full run  markets 1, accounts 1, sellers 1, products 0
                              + 3 unclaimed device rows (recorded, not fixed)

S3  boot-smoke                PR #32 -- gate 21 of 21, APPENDED not swapped
    green                     3 PASS, exit 0
    proven red                VITE_SMOKE_BREAK=1 -> 3 FAIL, exit 1
    citations converted       5, to gate ids

S4  the numbering ruling      PR #33 -- docs/build-status/README.md
    new register entries      none, deliberately: the ruling is D-127's

S6  this report               this PR

second adversarial round      78 agents, refute-by-default across #30-#34
    findings raised           34
    survived unanimously      9  -> D-134, D-135, D-136(renumber), D-137,
                                    D-138, D-139, and D-126's corrected count
    BLOCKER among them        1  -- the D-128 teardown orphaned the row a
                                    trigger made for its seller

new entries                   D-125..D-139 (fifteen)
gates                         21 on #32's branch, all green -- pnpm ci:local
                              main still has 20 until #32 merges
```

## S0 -- the conflict was already resolved, so it was verified rather than redone

The merge is `efd5c91`. It was in place before this order reached it, which
changes the job from resolving to proving: on an append-only file, a
resolution that looks right and quietly dropped an entry is indistinguishable
from a correct one by reading.

`git diff <parent> <merge> -- docs/build-status/DEFECT-REGISTER.md | grep -c
'^-[^-]'` prints **0** against both parents, and D-110 through D-124 appear
once each, in order. Nothing was lost. `git merge --abort` was not needed.

## S1 -- one comparator was exposed and one was not, and the difference is a rule

A comparator gate asserts that two forms agree. It is **exposed** when the
expected side is a document or fixture a person edits: delete the same row
from both and the gate reports agreement about a smaller world.

`verify:deferred-values` was exposed, and that is measured rather than
supposed. Removing `core.ladder_config.established_min_handoffs` from both
ADU-VAL-01 S1.1 and the fixture produced three PASSes and exit 0.
`EXPECTED_ROWS = 16` is now pinned in the gate, and re-planting the same
attack turns it red twice (D-126).

`verify:permission-doc` was **not** exposed: the same attack put it red on
eight checks, because it already pins 42 permissions, 139 grants, six
per-role totals and eight step-up codes by name. Appendix C checks 14 and 16
are not exposed either, and the reason is general enough to be written down
in `gates.mjs`: **their expected side is the live database, and nothing
leaves it without a migration.**

## S2 -- the environment had degraded until the product would not run in it

180 markets, 179 of them created one per test run, with a single
`timing_config` in force. `/v1/bootstrap` assigns by `(is_live DESC,
created_at ASC)`, so a browser could be handed a market with no timing row,
and the OTP request that follows fails -- D-112 at the scale a leak gave it.

The leak is closed at its source (D-128): the concurrent-decrement race test
now deletes what it created, by id, under `session_replication_role =
replica` -- required rather than convenient, because `core.stock_event` is
append-only and its trigger raises on DELETE for every role.

`pnpm db:reset` is the recovery. **Two** defects in it were found by
**running** it: an invented role password that left the API reporting its
database down, and a dropped `jobs` schema never reinstalled, which failed
`worker-runtime.spec.ts` with `permission denied for database adulis`.

A third was found by **reading** it, and the distinction is the rule this
block opens with. D-132 -- an unconditional `PASS` that two documents already
claimed was a check -- is precisely the defect a run cannot surface: there was
no branch between the counts and the print, so every run, correct or not,
printed PASS and exited 0. The adversarial pass recorded its verdict as
"CONFIRMED by reading, and by construction". This paragraph first credited it
to running, which named an instrument that could not have produced it, in a
block whose second line promises the opposite (D-139).

`db:reset` also took the permissive default on an unset `NODE_ENV` -- D-105's
own defect, inside the order that fixed D-105 (D-133).

D-131: `pnpm test` never loaded `.env`. From a clean shell, 420 of 459 tests
failed on `client password must be a string`. CI sets the environment in the
workflow, and `pnpm ci:local` loads it once for every gate to inherit, so the
only way to meet it is to run the command the README gives a new developer.

**D-129 is the connection this order asked for.** D-124 and D-114 are one
defect at two scales: an IP stops identifying a caller whenever callers share
one -- in the tests because every suite runs on one machine, in production
because a city sits behind one carrier NAT. Both are also how the two
environments come apart: **local and CI diverge in STATE, not
configuration.** CI builds from empty every run; this machine had been
accumulating since Tier 1. D-124 was red locally and green in CI. D-128 was
too.

## S3 -- the first gate that runs the console instead of reading it

`no-unsafe-eval` and `production-react` grep the bundle, and a bundle that
throws at module scope before React mounts is textually perfect. T7 Phase 5
shipped one.

`boot-smoke` serves `apps/console/dist`, replaying the `/*` block of
`dist/_headers` verbatim, drives headless Chromium, and asserts `#root` has
children with no uncaught error, no unhandled rejection and no CSP violation.
**The console mounts under the full production policy with zero violations**
-- new information, because this is the only place in CI where the policy and
the bundle meet.

**It is gate 21.** The T8 block above leaves that open ("20 is taken; the
smoke test is 21 unless swapped"); this is the answer, and it was appended
rather than swapped because positions in that list are cited in a governed
document. Gates 17 and 18 remain the console pair and ADU-RUL-03 S5.2 stays
true.

Proven rather than trusted: `main.tsx` carries a module-scope throw behind
`VITE_SMOKE_BREAK`, the exact shape of the Phase 5 defect. Built with it, the
gate reports zero children, the uncaught error, and the flag's survival into
the bundle. The flag cannot ship -- Vite drops the branch, and the gate fails
if the string appears in any emitted bundle.

## S4 -- rulings name findings; the register assigns numbers

ADU-RUL-03 S1's heading cites D-105 and `DOCUMENT_AUTHORITY.md` repeats it,
and the register skipped from D-104 to D-106. The citation pointed at
nothing. `docs/build-status/README.md` now states that rule, and the three it
sits with, in the directory they govern. No new register entry: the ruling is
already D-127's, and a second entry saying the same thing would be an entry
written to have written one.

Writing that file is also what caught D-136's own misattribution -- it
credited "Gate 20's boot smoke test" to D-123, and the line is D-120's. Every
claim was checked against the register rather than against the entry
asserting it, which is the only way that kind of error is ever found.

## What this order did NOT do

Out of scope by S5, and still owed: the console C-2 end-to-end and C-3;
vendor adapters; the operator surface; `ops/render.yaml` (D-80); D-73;
Amharic quality beyond the HUMAN-REQUIRED gate; and the four documents the
CEO owes.

Not fixed, and recorded rather than left silent:

- **Three unclaimed `core.device` rows survive a full test run** (bootstrap
  suites, `account_id NULL`). The same class as D-128 at a size that breaks
  nothing: a device with no account is never assigned to a sign-in. Fixing it
  belongs to an order that touches those suites.
- **D-114 stays parked**, and correctly -- `trust proxy` needs the deployment
  topology named, because trusting one hop too many lets a client forge
  `X-Forwarded-For` and choose its own bucket, which is worse than today.

## S-Parked -- what T8-C adds to the ruling list

- **D-125**: supply ADU-RUL-04 and ADU-RUL-05, or confirm that the "via
  T8-C" citation form stands permanently. Both are cited by section number
  against documents that were never delivered.
- **D-129**: D-114's ruling, plus one it adds -- when the subject collapses
  anyway, what identifies a caller for the OTP budget? The phone is already
  the subject of the per-challenge counter; whether it should also be the
  subject of the hourly one is a decision about enumeration cost, not a code
  change to make quietly.
- **D-130**: ADU-CON-02 v3.2 S13 gains `db:reset` and `worker:install`, or
  rules that the repository README is where operational commands live.
- **D-136**: ADU-RUL-03 S5.2 gains gate ids at its next reissue, after which
  the gate list stops being append-only for citation reasons and can be
  ordered by subject.
- **D-138**: whether `boot-smoke` should build a second, throwaway bundle with
  `VITE_API_BASE_URL` set to a forbidden origin purely to prove `connect-src`
  blocks it -- or whether that belongs to the console harness owed at C-3.
  Today the gate exercises load-time directives only, and says so.
