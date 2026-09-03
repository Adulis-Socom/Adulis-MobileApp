# WORK ORDER T14 REPORT

**The Rulings, the Design, and the Rest of the Console.** Part A is complete and
reviewed; Part B is complete; Part C was not started, and this report says why
and hands the next run each stage's traps. Every claim that asserts verification
names its command. `State of main` is a ref.

---

## PART A -- the back-end rulings

### Merge

**#45 -> #46 -> #47 -> #48, in order, fast-forwarded onto `main`.** Deleted lines
(register + gates.mjs): 0, 0, 0, and 3 at #48 -- the three are #48's own in-place
register corrections to #45/#47's entries (the D-134 precedent), not deleted
history; confirmed by reading the diff. `main` is now `edbda11`; `pnpm ci:local`
PASS all 24 gates on it. (The one scare, `deps-fires`, was PowerShell resolving
`bash` to a WSL stub, not the tree.)

### Stamped, not resolved -- D-180, D-193, D-203 (migration 0044)

```
market_id from the DEVICE's market on anonymous paths     otp.service.ts issueChallenge
verify re-resolves nothing; no market lookup on verify    verifyCode / verifyChallengeById
audience REJECTED at verify, not ignored                  auth.controller.ts otpVerify
  pnpm --filter @adulis/api test -- t14-a3   (S31.1's three arms)
countable difference between two markets, anonymous       none -- the budget is stamped, not looked up
  t13-delivery-layer "S17 -- anonymous OTP takes its timing from the DEVICE"
S5.3's tuple included audience before this                NO -- audience was not stored, so the tuple
  could not include it; the rule was NARROWER than stated. Second finding D-208, PARKED
```

The three defects were one: a value the challenge should have carried was
re-resolved later from a source that could differ. D-203's oracle -- the count of
wrong guesses before the 429 IS the resolved market's `otp_max_attempts`, and the
market was the account's -- is closed by stamping the budget on the row. D-193 is
closed for free: spend attributes through `otp_challenge.market_id`.

### Transport before supersession -- D-204.1 (migration 0045)

```
an un-transported challenge is unverifiable               t14-a4 arm 1
a FAILED resend leaves the previous code live             t14-a4 "a FAILED resend leaves the previous code live"
  pnpm --filter @adulis/api test -- t14-a4
```

Supersession moved from mint to provider ACCEPTANCE. `transported_at` gates
verifiability, and it is the CHALLENGE's own column, not `otp_delivery_status`
(S12.2 forbids deriving validity from transport status). The adversarial pass
found the first `markTransported` could ZERO OUT BOTH codes under two concurrent
accepts (a targeted sign-in/step-up DoS, D-212); it is now one transaction,
serialized by a per-(phone, purpose) advisory lock, newest-wins, with a
concurrency test proving exactly one live survivor.

### is_live withdrawn -- D-183 (migration 0046)

```
column dropped, guard moved onto activation_state         db:check check 13 attached
readers moved: /v1/bootstrap, orders.service              t8-market "the two market readers resolve by activation_state"
structural test extended                                  YES -- the two readers pinned to activation_state, never is_live
  pnpm --filter @adulis/api test -- t8-market-from-device
```

The pass found two writers OUTSIDE `apps/api/test` (a load harness the
`*.spec.ts` glob never runs), fixed; and three drift artifacts recorded rather
than hidden -- a stale generated type CI codegen removes, ADU-DB-01 v1.14's own
prose (v1.15's to correct, yours), and a latent bootstrap-503 parked as a ruling
(D-216).

### The platform-scoped limiter, and the transcription gate -- D-192, D-210

```
limiter platform-scoped, ceiling 50000                    bootstrap.controller.ts PLATFORM_MINT_SUBJECT
gate landed in T13                                        NO -- it did not; built here (D-210)
gate widened                                              YES -- five enums, six statuses, S12.1 fields, S9.1 columns
gate self-checks                                          YES -- asserts its parse BEFORE comparing; caught its own
                                                          fence-index bug before it ever compared anything
gate red both ways                                        YES -- and the pass found it was one-directional for the
                                                          fields and the provider set, now corrected (D-214)
  pnpm verify:transcription
```

The bootstrap mint limiter keyed on `req.ip`, and nothing sets Express
`trust proxy`, so behind a proxy it was a platform-wide counter wearing a per-IP
label; it now collapses to one subject on purpose -- the second platform-scoped
control beside `platform_otp_budget`.

---

## PART B -- the design system

```
tokens PLACEHOLDER removed                                YES -- packages/tokens: index.ts, tokens.css, README
contrast                                                  high-contrast ramp; lightest text ~5.3:1 on white, body ~17:1
type scale at Amharic lengths                             by construction: generous line-heights (heading 1.3, base 1.5),
                                                          NO fixed heights; Noto Sans Ethiopic fallback
primitives built                                          NONE -- values only (the three seams)
  pnpm ci:local   PASS all 25 gates   (Part B branch off main)
  @adulis/tokens tsc clean; console build built against the new tokens
```

A warm neutral ramp (0..900) with roles derived from it, ONE accent for action
with hover/active/subtle, semantic state as triples (never colour alone), a 44px
target, and a visible keyboard-only `:focus-visible` ring. A strict SUPERSET:
every token key and CSS custom property the placeholder exported is kept at a
real value, and two the console referenced but never defined
(`--adu-color-surface-muted`, `--adu-font-mono`) are now defined. Applying the
state colours in console CSS is Part C, kept out of the `packages/*` change (its
own PR, the seam rule).

---

## PART C -- NOT STARTED, and why

**Stages reached: none.** A deliberate stop, not an abandonment.

The order rules that "a half-finished stage is worse than a stage not started"
and that nothing may be "described as verified [that] a browser has not
rendered." C-5 alone is five screens (SC-07..SC-11), each needing its full state
matrix, copy, MT keys and a `console-e2e` arm that plants its violation. Starting
that at the end of a long unattended run would mean shipping screens unrendered.
So Part C is handed to the next run intact, with each stage's traps below.

**C-5's first task is the state visual language**, not a separate one: the twelve
`ScreenState` branches consume Part B's semantic triples in
`apps/console/src/console.css` (colour paired with the text each branch already
renders). It was not done in Part B because the seam rule keeps console CSS out
of `packages/tokens`, and a primitive is not extracted before the screen needs it.

### The traps waiting per stage (from S8.2)

- **C-5 catalogue (SC-07..SC-11).** Nine readiness items, not ten (R7(c) removed
  `ACTIVE_HOURS`). The product cap is the intersection of tier and level, and
  SC-07's counter must say WHICH binds ("10 of unlimited" is a bug report). The
  slug is immutable (G1.9); a rename must warn at the moment. Stock is events,
  never a client number; media 5 images / 1 video / <=480p / <=30s.
- **C-6 store and administration.** Eight step-up actions (`StepUpModal`: 403
  opens it, the action retries on success). R21: payout-cancel renders only with
  a PENDING row (absent, not disabled). R27: availability overrides are presence,
  not a boolean. R22: one of eight notification categories is locked (PATCH 422 ->
  render as locked). G1.3: closure stays available while deletion is blocked,
  every blocker in `items[]`. G1.6: ownership transfer by MEMBERSHIP id, residual
  role excludes ADMIN.
- **C-7 trust, chat, notifications.** Reviews read-only; claims respond-only.
  Analytics is a 90-day live window (R19); the chat anchor is on the MESSAGE
  (D-73); notification read state syncs across surfaces.
- **C-8 courier (SC-C1).** R25: the QR renders only after custody acceptance --
  absent before, not greyed.

**A gate before any screen: which endpoints exist.** ADU-CON-03 S17 -- "a screen
whose endpoint does not exist is not built." The next run reads
`contracts/openapi.json` first.

---

## GATES

```
pnpm ci:local                       PASS all 25 gates   (#49, #50; and #51 off main)
pnpm --filter @adulis/api test      507 passed, 43 suites, clean reset
                                    (at --maxWorkers=2; the test gate flakes under
                                    default parallelism on this machine -- D-217)
pnpm verify:transcription           PASS, providers parsed, proven red both ways
pnpm db:determinism                 converges, 11,625 lines
pnpm db:check                       16 checks, check 13 (the market-live guard) attached
pnpm verify:appendix                PASS      pnpm verify:permission-doc   PASS, 252 cells
pnpm verify:console-e2e             21 passed against the real API (Part B branch)
```

---

## REGISTER

**Eleven new entries, D-207 to D-217.** No BLOCKERs this tier; the sharpest was
D-212, a MAJOR concurrency DoS the pass caught before merge.

| | |
|---|---|
| **D-212 MAJOR** | markTransported could zero out both codes -- a targeted sign-in/step-up DoS. FIXED (advisory lock, newest-wins) |
| **D-207 / D-203 MAJOR** | the attempt budget was a countable enumeration oracle. CLOSED by stamping |
| **D-213 MAJOR** | "the device channel cannot be faked" was FALSE. Corrected; account-binding hoisted to both arms |
| **D-216 MAJOR** | the is_live sweep missed two writers outside the test glob. FIXED |
| **D-208** PARKED | S5.3's tuple is (phone, purpose, AUDIENCE); supersession still scopes to (phone, purpose) |
| **D-209** | the platform-scoped mint limiter |
| **D-210** | the transcription gate, which caught its own parser first |
| **D-211** | transport before supersession |
| **D-214** | the transcription gate was one-directional where it claimed both ways; FIXED |
| **D-215** | is_live withdrawn |
| **D-217** MINOR | the API test gate flakes under default parallelism on one shared Postgres |

**And the claims of mine the passes corrected**, recorded in the entries rather
than quietly fixed: "the channel cannot be faked" (D-213), "both ways" for the
transcription gate (D-214), the 0045 "same statement" comment, and a commit
message that said "508 passed" when the count was 504. The code was right more
often than the reasons I gave for it -- the failure that survives review by being
pleasant to read.

---

## PARKED -- each with the ruling it needs

| Item | Needs |
|---|---|
| **D-208** -- supersession scope | should the live-challenge tuple honour AUDIENCE, letting one phone hold a live MOBILE and CONSOLE code at once? The stamp now makes it possible |
| **D-216.4** -- bootstrap 503s when no market is ACTIVE | should a returning device be served from its OWN (possibly SUSPENDED) market rather than 503? |
| **D-202** (T13) -- the platform OTP ceiling | confirm 2000/5000, or set it with the real per-message price (S9.3 item 8) |
| **D-196** (T13) -- no wire code for "market unavailable" / "issued, not transported" | whether ADU-API-01 gains them |
| **D-217** -- the flaky test gate | cap the API test-gate workers, or give it its own database |
| **the design-system state CSS** | not a ruling -- C-5's first task |

**Owed by the founder, not me** (T14 S9): ADU-DB-01 v1.15's prose (D-190, and the
is_live removal from S5.1 / S9.1 -- D-216.3), ADU-API-01's amendment for
`MARKET_UNAVAILABLE` and the transport-failure code (D-196), and the five
contract rulings D-153 to D-157.

---

## State of main

**`edbda11`** -- all of T13, merged in order. **Nothing from T14 is merged.**

| PR | Branch | Base | Contents |
|---|---|---|---|
| #49 | `tier14/t14-a-challenge-lifecycle` | main | Part A: stamping (0044), transport (0045), the limiter, the transcription gate. Pass done |
| #50 | `tier14/t14-a5-withdraw-is-live` | #49 | Part A5: is_live withdrawn (0046). Pass done |
| #51 | `tier14/t14-b-design-system` | main | Part B: the design system. Independent |

**Merge order: #49 -> #50 (stacked), then #51 (independent, off main, touches only
`packages/tokens`).**

---

*Part A was ruled and it is done: four phases, each built to a founder ruling,
each adversarially reviewed, each finding fixed before its PR was left for merge
-- including a concurrency DoS and a security claim of mine that was simply wrong.
Part B replaced twenty-two screens' worth of placeholder with a real system
before those screens inherit it. Part C is where the volume is, and it is
untouched on purpose: the order's own rule is that a half-rendered stage is worse
than a named one, and I would rather hand the next run five intact screens with
their traps written down than five started ones I never watched a browser draw.*
