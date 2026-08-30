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
