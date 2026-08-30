# T7 Phase 5 -- adversarial review (the console, four lenses)

**Ran against:** `tier7/t7-phase-5-console`, commit `a633aec`
**Diff base:** `25a6b1f` (Phase 4)
**When:** T7 Phase 5, before PR #24 merged
**What it produced:** The finding that the console bundle threw before React mounted -- a blank page every gate passed over -- plus the idempotency-key reuse, the absent sign-out, the input-driven idle clock and the duplicated state-mapper arms. Applied in `1c86e02`. Register: D-101, D-102, D-103, D-104.

> **Provenance.** Recovered in full from the workflow run artifact on disk.
>
> This file was committed at **T8-R**, after the fact. The review itself was not
> committed when it ran -- no adversarial review in this repository ever was,
> which is the gap T8-R exists to close (T8-R S3). The text below is the
> reviewers' own, recovered verbatim; nothing has been rewritten or corrected.
>
> **What is here and what is not.** Four lens reviewers each had their findings
> re-checked by a separate skeptic, and it is the SKEPTICS' verdicts that the
> artifact preserved -- each one restates the finding it is judging, so the
> substance survives, but the lens reviewers' original prose does not. Where a
> skeptic writes REFUTED, the finding it refutes was one of mine to dismiss,
> not one of theirs to fix.

---

## Lens: rules -- skeptic's verdict

Verified every claim against the working tree at `a633aec` (clean except untracked `docs/build-status/T7-REPORT.md`).

---

# VERDICTS

## F1 — CONFIRMED (line refs off by one)
- `apps/console/src/auth/SignIn.tsx:44-45` mints both keys at mount; `:207-216` ("Change number") resets `step`/`code`/`problem` only.
- `apps/api/src/common/idempotency/idempotency.ts:80-81` (review said 79-81) raises on hash mismatch; `error-catalogue.ts:125` → **409**, `retryable: false`. String confirmed at `packages/locale/src/en.ts:102`.
- Actor stability confirmed: `handler-transaction.ts:191-199` (`actorFor`) falls to `{kind:'DEVICE', id: x-adulis-device}`; `api/client.ts:30-31,51` pins one value per app load.
- `remint` has **zero** call sites in `apps/console/src` (only its own definition at `lib/idempotency.ts:18`).
- Second-order confirmed: `auth.controller.ts:83-106` — `toSend` is assigned *inside* the `runIdempotent` closure, so a replay leaves it `null` and `sms.send` is never reached; `SignIn.tsx:66` still advances.
- The "verifyKey is safe by accident" rider is right: `idempotency.record` sits at `auth.controller.ts:175-178`, inside `this.tx.run` opened at `:165`, so a throw from `verifySignIn` discards the claim.

## F2 — CONFIRMED, and stronger than stated
`SignIn.tsx:37,108` vs `auth.service.ts:109-122` (cookie-driven, `remember_device` not consulted) and `:145-149`. Server truth confirmed at `auth.service.ts:194`, used on the boot path at `session.tsx:70`.

The impact is *not* speculative — **the server actually enforces the divergent idle window**: `apps/api/src/common/auth/session.service.ts:88-93`
```
THEN now() > s.last_activity_at + tc.console_remembered_idle
ELSE now() > s.last_activity_at + tc.console_idle_timeout
```
and `db/migrations/0002_markets_and_configuration.sql:302,304` + `ops/scripts/seed.mjs:59-60` give exactly 30 min / 8 h. So the client's 30-minute warning on a server-remembered session is a real 7.5-hour error, not a cosmetic one.

## F3 — CONFIRMED
`stateFromProblem` and `ScreenState` grep clean except `StateDemo.tsx:9-10,40`. `Placeholder.tsx:6` and `RequireSession.tsx:10-13` duplicate the EMPTY/LOADING markup. `router.tsx:18-41` has no `/dev/states`; `StateDemo` is the `index: true` of `/s/:sellerId` (`:30`).

Report claim confirmed but **mis-cited**: it is at `T7-REPORT.md:143-145` and `:154-155`, not `:139-141`.

Caveat on the illustration: `CLIENT_UPGRADE_REQUIRED` is defined at `error-catalogue.ts:130` and **thrown nowhere in `apps/api/src`**, so that specific banner-plus-form render is currently unreachable. The structural finding stands regardless.

## F4 — CONFIRMED
`Shell.tsx:73`, `IdleWarning.tsx:17`, doctrine at `lib/intl.ts:2-3`, payload at `bootstrap.controller.ts:34,100-104`. Grep for `bootstrap` across `apps/console/src` returns **three comments and zero call sites** (`session.tsx:13`, `intl.ts:3`, `states.ts:24`).

## F5 — **REFUTED**
The report says the opposite of what the review quotes. Grep for `clock` in `T7-REPORT.md` returns exactly one hit, `:182-186`:

> **Rule 3** asks for three clock treatments; C-1/C-2 display exactly two … so the third has no surface to land on.

and `:176-181`:

> Four could not be exercised, **and I am not claiming them**: **rule 5** … and **rule 9** … have NO surface in C-1/C-2 … **Rule 4** … has no handoff surface either.

`T7-REPORT.md:147-149` reads "intl.ts holds the formatting seam: absolute market time, currency from minor units, and whole-sentence templates" — the string "the three clock treatments in one module" does not exist in the file. The four attestations F5 is built on are fabricated; the report is explicitly honest about precisely these four rules. (The underlying code facts — `intl.ts` is 39 lines with four functions, `blob-viewer.ts` absent — are true but attach to no false claim.)

## F6 — CONFIRMED
`lib/states.ts:63-64` is verbatim two identical arms. `CLIENT_UPGRADE_REQUIRED` is 403 and short-circuits at `:60`, but `PERMISSION_DENIED`/`OWNER_ONLY`/`NOT_FOUND` (403/403/404 per `error-catalogue.ts`) all fall to `TRANSPORT_ERROR` and get `ScreenState.tsx:89-91`'s retry button. `NO_PERMISSION` is unreachable from this function.

## F7 — CONFIRMED verbatim
`console.css:178` is exactly `width: auto; min-height: auto; width: 1.25rem; height: 1.25rem;`. `min-height: auto` cancels `console.css:44`. Header assertion at `:13`; `packages/tokens/src/index.ts:59-60` says "minimum touch target, both axes".

## F8 — CONFIRMED
Grep for `aria-live|aria-busy|role="status"` across `apps/console/src` returns exactly three hits — `SignIn.tsx:163,197`, `StepUpModal.tsx:108` — all on submit buttons. No region, no container `aria-busy`. `ScreenState.tsx:30-31`'s justification cites a busy region that does not exist.

## F9 — CONFIRMED
`StateDemo.tsx:27-38`: `role="tablist"` + `role="tab"` + `aria-selected`, no `aria-controls`, no `role="tabpanel"` on `:39`, no `tabIndex`, no key handler.

## F10 — CONFIRMED
`Feedback.tsx:55` hard-codes `` `#signin-${e.field}` ``, reached from `ScreenState.tsx:77` and demonstrated dead at `StateDemo.tsx:43`.

## F11 — CONFIRMED
Register headings at `DEFECT-REGISTER.md:943/954/965` = device_platform / idle values / sellers list. `Shell.tsx:38` says D-95 (wrong), `am.ts:195` says D-96 (wrong, and user-facing), `en.ts:211` and `Chooser.tsx:5` say D-97 (right).

## F12 — **REFUTED**, both halves
1. **There is no FK violation and no 500.** `auth.service.ts:95-99` pre-empts it:
```ts
const device = await sql<{id:string}>`SELECT id FROM core.device WHERE id = ${body.device_id}`...
if (!first(device.rows)) throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'device_id' } });
```
`error-catalogue.ts:123` → **400**, `error.request.validation_failed`. The seller sees "The request is not valid."
2. **The register does not understate it.** `DEFECT-REGISTER.md:945` Severity line: "*MAJOR (parked with a dev workaround; **production console sign-in cannot register a device truthfully**)*". F12 read the Effect paragraph and missed the Severity line stating exactly its point.

## F13 — CONFIRMED
`AM_ENABLED` appears in 11 places repo-wide, all prose (`am.ts:16,144`, `generate-mt-keys.mjs:7,27`, `MT-KEYS.md:5`, `T7-REPORT.md:152`, spec docs). No symbol, no import of `am` in `apps/console/src`. Presence gate sound: en=149, am=149, MT bullets=149 (counted).

## F14 — CONFIRMED
`idempotency.ts:15` `useRef<string>(mintKey())` (eager, per render) vs `StepUpModal.tsx:48` `useState(mintKey)` (lazy).

## F15 — CONFIRMED
`session.tsx:29-30,69` vs `SignIn.tsx:108`; zero consumers of `accountId`.

## "Hunted and refuted" section — all spot-checks hold
Storage grep across `apps/console/src` returns one hit, the prohibition comment at `client.ts:14`. `git diff --name-only 25a6b1f..a633aec -- apps/console/public/` is empty. Locale counts verified 149/149/149. `states.ts:62` does map 429→CONFLICT. `console.css:89,127` do `display:none` the inactive nav. The remember-device refutation is right (`auth.service.ts:112-115` keys on `token_hash + account_id` only). Rate-limit slot name matches (`rate-limit.service.ts:73` `retry_after_seconds` ↔ `Feedback.tsx:28`).

---

# MISSED — real, ordered by severity

**M1 · MAJOR · `SignIn` can never sign in a phone number that has no account.** `auth.schemas.ts:26` + `auth.service.ts:74-82`: when no `core.account` row exists, verify requires `age_declared_over_18 === true` or throws `VALIDATION_FAILED` with `slots.path = 'age_declared_over_18'`. `SignIn.tsx:100-106` sends `{phone, code, audience, device_id, remember_device}` — no such field, and no control exists to collect it. The seller receives a real SMS from `/otp/request` (which has no account precondition), types a correct code, and gets "The request is not valid." with no field to fix. This is a dead end the register does not cover, and it is *independent* of D-95.

**M2 · MAJOR · the idle warning is sticky and never clears itself.** `session.tsx:103-105`:
```ts
const onActivity = () => { lastActivity.current = Date.now(); };
```
It resets the clock but never calls `setIdleWarningAt(null)`. Only `touch()` (`:86-89`), reachable solely from `IdleWarning`'s "Stay signed in" button, clears it. Once the banner appears, a seller who simply resumes working keeps it on screen indefinitely — pinned by `console.css:150-162` over the bottom bar — displaying a frozen, now-false `{time}` from `en.ts:198` ("You will be signed out at {time}").

**M3 · MAJOR · the activity proxy fails in the direction that loses the session.** `session.tsx:92-93` argues local activity is the honest proxy because "a fully quiet client makes none". The real console is the inverse: `session.service.ts:137,145` bumps `last_activity_at` only on an authenticated request, and after boot the console issues **none** — every C-1/C-2 screen (`StateDemo`, `Placeholder`, `Chooser`) is inert. A seller clicking around for 35 minutes keeps `lastActivity.current` fresh, so the warning never fires, while the server's 30-minute `console_idle_timeout` has already expired the session. The warning is not merely mistimed by D-96's config drift — it is structurally unreachable for the common case.

**M4 · MODERATE · "the 401 is handled" is true only for two call sites.** `client.ts:79-83` throws a plain `ApiError` with no 401 branch, and there is no interceptor, no error boundary, no `signedOut()` wiring outside `keepAlive` (`session.tsx:140-145`) and the boot probe. `T7-REPORT.md:164-165` and `session.tsx:16-18` both lean on that handling as the reason the mistimed timer is safe. Related: `keepAlive` swallows every non-401 error, so `IdleWarning.tsx:26`'s `.then(touch, …)` dismisses the warning on a network failure that never reached the server.

**M5 · MODERATE · a fourth wrong register citation, which F11 missed.** `IdleWarning.tsx:4` — "see session.tsx for why the limits are the shipped defaults (**D-93**)". D-93 (`DEFECT-REGISTER.md:889`) is "The console build-output gates failed every scoped CI run"; the idle gap is D-96, as `session.tsx:14,16,24` correctly says.

**M6 · MODERATE · F6's rider: the request id never renders where S4.6 needs it.** `Feedback.tsx:35` gates the request id on `status >= 500 || status === 0`. Every 401/403/404 that F6 shows landing in `TRANSPORT_ERROR` therefore renders a retry button and **no request id** — breaking the rule transcribed in that same file's header at `Feedback.tsx:4`.

**M7 · MODERATE · `StepUpModal` is dead code with an unmanaged dialog.** Grep returns no importer anywhere in `apps/console/src`. Its `role="dialog" aria-modal="true"` (`:90`) has no initial focus, no focus trap, no Escape handler, and no focus restoration — the `role="presentation"` backdrop at `:89` is also not click-dismissible. The review declared this file clean.

**M8 · MODERATE · no focus management on either state transition in the one real screen.** `SignIn.tsx:66` replaces the entire form (phone → code) with no focus move and no announcement; `:55,91` populate `fieldErrors` and render `ValidationSummary` with no focus move to it. S15's summary-of-anchor-links pattern assumes focus lands there.

**M9 · MINOR · duplicated rate-limit sentence.** For a 429, `Feedback.tsx:27` renders `error.request.rate_limited` (`en.ts:103`, already carrying `{retry_after_seconds}`) and `:29-33` then renders `console.signin.rate_limited` (`en.ts:186`) saying the same thing again.

**M10 · MINOR · `UPGRADE_REQUIRED` is doubly unreachable.** Beyond F4's missing bootstrap call: no API code path throws `CLIENT_UPGRADE_REQUIRED`, and `bootstrap.controller.ts:28,99` hard-code `MIN_SUPPORTED_CLIENT = '0.0.0'` and `client_status: 'OK'`.

**M11 · MINOR · `IdleWarning` is mounted only inside `Shell`** (`Shell.tsx:73`), and `router.tsx:23` puts `Chooser` at `/` outside it. A signed-in seller parked on the store chooser gets no idle warning at all.

**M12 · MINOR · secure-context dependency.** `client.ts:31` and `idempotency.ts:10` call `crypto.randomUUID()` at module scope; it is undefined outside a secure context, so serving the console over plain http on a LAN IP throws before React mounts — a blank page, not a `TRANSPORT_ERROR`.


---

## Lens: security -- skeptic's verdict

## Verification against `tier7/t7-phase-5-console` @ a633aec (diff base 25a6b1f)

Working tree matches: `git rev-parse HEAD` = `a633aec6854…`, branch `tier7/t7-phase-5-console`. Diff touches 39 files; on the API side **only** `apps/api/src/modules/auth/sms.adapter.ts` (+8).

---

## HIGH

### H1 — **CONFIRMED**, with one overstatement corrected
`C:\Users\naods\Documents\Work\adulis-platform\apps\console\src\auth\session.tsx:103-107` registers `pointerdown`/`keydown` and writes `lastActivity.current`. `apps\api\src\common\auth\session.service.ts:90-92` evaluates idle against `s.last_activity_at`, and `:115-117` only touches it via `this.touch(row.id, …)` on an authenticated request (gated by `ACTIVITY_TOUCH_FLOOR_SECONDS = 60`, line 62). Grep for `\btouch\b` in `apps/console/src` returns **only** `IdleWarning.tsx:15,26` and the provider's own definition — `api()` never stamps the clock. The two clocks are independent, confirmed.

**Correction:** "provably cannot fire before the server expires the session" is too absolute. In the *fully quiet* case (last input ≈ last request) the two clocks are aligned and the warning fires correctly. The defect is the *active-but-request-less* case: input at T+25min pushes the client warning to T+50 while the server expires at T+30. The finding is real; the universal claim is not.

### H2 — **CONFIRMED** on every sub-claim
- `Select-String "401"` over `apps/console/src` → 5 hits: `session.tsx:7,17,18,74` (all comments) and `session.tsx:144` (`keepAlive`). `api()` has no 401 branch. ✔
- `session.tsx:125` — `signedOut: () => setSession(null)`. No revoke call. ✔
- `Shell.tsx:44-46` renders `<button type="button" aria-label={en['console.shell.account']}>` with **no `onClick`**. ✔ (review said line 44 — correct.)
- `common.signOut` exists at `packages/locale/src/en.ts:28` and has zero render sites. ✔
- The means exist: `auth.controller.ts:215` `@Delete('auth/sessions/:id')`; `auth.service.ts:202` returns `current: s['id'] === current`; `session.tsx:65-71` reads that row and discards `id`. ✔

Note the review's line reference for `Shell.tsx` NavLink (`:60`) is actually `:52`/`:66` — cosmetic.

### H3 — **CONFIRMED**, and the exposure is worse than stated
`sms.adapter.ts:47-48` prints `message.phone` and `message.slots`; `otp.service.ts:198` is `slots: { code, …args.extraSlots }`. `logging.ts:82-99` lists `otpCode`, `phone`, `phoneNumber` in `NEVER_LOG` and `:42-59` allow-lists log fields — `console.warn` bypasses both. `fake-guard.ts:24` fires only on `=== 'production'`.

Repo-wide `NODE_ENV` grep: the only assignments are `.env:62` and `.env.example:92`, both `development`, plus test files. `apps/api/package.json:10` is `node dist/main.js`. `ops/render.yaml` does not exist (`Get-ChildItem -Filter render*.yaml` → empty; D-80 at `DEFECT-REGISTER.md:769` says so). `ops/runbooks/deploy.md` contains **no** `NODE_ENV` instruction at all. Nothing anywhere sets it to `production`. Confirmed, and note the step-up path leaks too: `stepUpRequest` → same adapter, so payout/ownership-transfer codes are also written in clear.

---

## MEDIUM

### M4 — **CONFIRMED**
`SignIn.tsx:44` `const requestKey = useIdempotencyKey()` at screen scope; `:63` uses it; `:207-216` "Change number" resets `step`/`code`/`problem` only. `handler-transaction.ts:140` `hashRequest(req.method, req.path, req.body)`, `:142` `check(...)`; `idempotency.ts:80-82` throws `IDEMPOTENCY_KEY_REUSED`; `error-catalogue.ts:125` → 409. Actor is `{kind:'DEVICE', id: X-Adulis-Device}` (`handler-transaction.ts:191-196`) — stable for the page load, so the collision is real. `remint` has **zero** call sites outside its own definition (verified by repo-wide grep).

**Corollary the review missed:** re-submitting the *same* number is worse than the 409. `check()` returns the stored `{}`, `api()` resolves, `SignIn.tsx:66` advances to the code step — and `auth.controller.ts:103-105` dispatches SMS only `if (toSend)`, which a replay leaves null. The seller waits on a code that was never sent, with a success-looking UI.

### M5 — **CONFIRMED**
`client.ts:80-82`: `JSON.parse(text)` executes before `if (!res.ok)`. Catch sites are `if (e instanceof ApiError)` at `SignIn.tsx:69,82,111` and `StepUpModal.tsx:63,82` — a `SyntaxError` falls through every one, `finally` clears `busy`, nothing renders.

### M6 — **CONFIRMED**
`states.ts:63-64` is literally two identical returns. 401 (`SESSION_EXPIRED`, `error-catalogue.ts:52`), 403 (`STEP_UP_REQUIRED` :58, `PERMISSION_DENIED` :63), 404 (`NOT_FOUND` :138) all land on `TRANSPORT_ERROR`, which `ScreenState.tsx:85-92` renders with an unconditional Retry button that ignores `retryable`. `NO_PERMISSION` (`ScreenState.tsx:62-64`, returns `null`) is unreachable from the mapper. `stateFromProblem` has no call sites; `ScreenState` is used only by `StateDemo.tsx:40`.

### M7 — **CONFIRMED**
`StepUpModal.tsx:50` `as MessageKey` on `` `console.stepup.prompt.${action.toLowerCase()}` ``; `MessageKey = keyof typeof en` (`en.ts:221`). All eight keys present (`en.ts:190-197`, `am.ts:174-181`) so latent, not live. The suggested `Lowercase<StepUpAction>` template type is the right fix.

### M8 — **CONFIRMED**
`SignIn.tsx:108` `remembered: remember` from the checkbox; `session.tsx:96` selects the window from it. Server truth: `auth.service.ts:147` `WHEN ${accountDeviceId}::uuid IS NOT NULL THEN tc.console_remembered_lifetime`, and `accountDeviceId` is set only at `:116` or `:123-133`. Authoritative value is available at `auth.service.ts:194` `(s.account_device_id IS NOT NULL) AS remembered`.

### M9 — **CONFIRMED**
`session.tsx:143-145` rethrows only 401; `client.ts:70-77` mints `status: 0` for a fetch rejection. `IdleWarning.tsx:26` `keepAlive().then(touch, …)` — resolve path runs `touch`, clearing the warning and resetting the clock on a request the server never saw.

### M10 — **CONFIRMED**
`session.tsx:97-101` only ever calls `setIdleWarningAt(<value>)`. `onActivity` (`:103-105`) touches only the ref. `setIdleWarningAt(null)` appears at `:88` (`touch`) and `:122` (`signedIn`) only. Banner is sticky, and the time it names is frozen at `lastActivity.current + idleMs` from the moment it was set.

### M11 — **SPLIT: first half CONFIRMED (harder than the review argued); second half REFUTED**

**Confirmed, and demonstrable in the tree.** The local `apps/console/dist/assets/index-C9twJQQY.js` minifies to:

```js
const jb="http://127.0.0.1:4010";
function Hb(n){throw new Error(`API base URL is not configured. Set VITE_API_BASE_URL — for local work run \`pnpm mock:api\` and point it at ${jb}.`)}
const Bb=Hb(),Xy=crypto.randomUUID();
```

`resolveApiBaseUrl` was constant-folded down to nothing but its throw, and `Bb=Hb()` is evaluated at module top level. **The committed build gate passes a bundle that throws before React mounts.** `gates.mjs:196-197` check only `unsafe-eval` absence and React-production; neither would notice. `.github/workflows/ci.yml` sets no `VITE_` var. Confirmed, and it is a stronger finding than written.

**Refuted.** The claim that "a production bundle built in the wrong shell ships pointed at 127.0.0.1, because the root `.env` still carries `.env.example:102`'s value" is wrong on both legs:
- `Select-String -Path .env -Pattern VITE` returns **nothing**. `.env` keys are `DATABASE_URL`, `DATABASE_URL_JOBS`, `DATABASE_URL_MIGRATE`, `SMS_PRIMARY_API_KEY`, `SMS_SECONDARY_API_KEY`, `CONSOLE_ORIGIN`, `NODE_ENV`, `PORT`, `POSTGRES_HOST_PORT`. No `VITE_API_BASE_URL`.
- `const jb="http://127.0.0.1:4010"` is `MOCK_API_BASE_URL` (`packages/api-client/src/index.ts:20`) surviving **inside the error message string** at `:44` — not a baked base URL. The bundle proves the opposite of what the review read into it.

`crypto.randomUUID()` at module scope (`client.ts:31`, visible as `Xy=` above) is real but moot in the same build: `Hb()` throws first.

### M12 — **CONFIRMED**
`seed.mjs:20-24` guards only on a connection string, prefers `DATABASE_URL_MIGRATE`; `:38-41` inserts a market with `is_live` `true` and no environment refusal, unlike `fake-guard.ts:24`. `auth.service.ts:83-84` is `SELECT id FROM core.market WHERE is_live LIMIT 1` with no ORDER BY — and `otp.service.ts:90` repeats it, while `bootstrap.controller.ts:59` and `orders.service.ts:71` use `ORDER BY is_live DESC, created_at ASC`. No unique or partial index constrains `is_live` (`0002_markets_and_configuration.sql:35` is a plain `boolean NOT NULL DEFAULT false`), so two live markets are permitted and the nondeterminism is reachable.

---

## LOW — all three CONFIRMED

- `Feedback.tsx:14-17`: `if (!template) return key;` — server-supplied `title_key` into `role="alert"` at `:27`. React escapes it; the file's line-8 invariant is nonetheless not what the code does.
- `session.tsx:68`: `accountId: ''`.
- `.env.example`: line 102 is `VITE_API_BASE_URL=http://127.0.0.1:4010`, no `VITE_DEVICE_ID` anywhere, while `apps/console/CLAUDE.md:41` says `http://localhost:3000` and `seed.mjs` prints the same.

---

## Spot-check of the "hunted and refuted" section

All hold. XSS-sink grep over `apps/console/src` (`dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document.write|eval(|new Function`) → **zero hits**. Storage grep (`localStorage|sessionStorage|indexedDB|document.cookie`) → one hit, the comment at `client.ts:14`. `fillTemplate` (`intl.ts:37-39`) uses a replacer function — no `$&` interpretation, no re-expansion. `_headers` is untouched by the diff and carries the stated CSP. `origin.middleware.ts:30-31` skips on absent session cookie, as described. Locale parity is exact: **149 keys in `en.ts`, 149 in `am.ts`, symmetric difference empty**. The `verifyKey` refutation is right — `otpVerify` records inside `tx.run` at `auth.controller.ts:175-178`, after `verifySignIn`, so a failed verify writes nothing.

One label error: `console.css:132` is `.skeleton-row`, not "a status dot". The substance (no text in either fixed-height rule) survives.

---

## What this review missed

**1. First-time sign-in through the console is impossible — no age declaration (HIGH-adjacent, compliance).**
`otpVerifyBody` (`auth.schemas.ts:26`) makes `age_declared_over_18` optional, and `auth.service.ts:78-82` throws `VALIDATION_FAILED` when a *new* phone omits it. `SignIn.tsx:100-106` sends `phone, code, audience, device_id, remember_device` and nothing else. There is no age-gate control anywhere in the console. ADU-AUTH-01 S13's identity-creation block is unreachable from the surface that is supposed to satisfy it, and no register entry covers this.

**2. `VITE_DEVICE_ID` is a build constant, so ADU-CON-02 S7.2's new-device payout lock is inert on the console (HIGH).**
The device identity is baked at build time (`client.ts:30-31`) and shared by **every browser loading that bundle**. `db/migrations/0022_payout_and_reissue_functions.sql:95-102` locks payout changes when `min(core.session.created_at)` for `(account_id, device_id)` is inside `new_device_payout_lock`. With one shared `device_id`, an attacker who obtains a victim's OTP and signs in from an entirely different machine inherits the victim's *oldest* session timestamp for that id — the 24-hour lock never fires. Without `VITE_DEVICE_ID`, the per-load random uuid has no `core.device` row and `auth.service.ts:95-99` returns `VALIDATION_FAILED`, so production sign-in fails outright (`POST /v1/devices` only accepts `ANDROID|IOS`, `auth.schemas.ts:56`). D-95 names the *registration* dishonesty; it does not name the payout-lock consequence or the shared-identity consequence, and the review inherited that blind spot from the register.

**3. `StepUpModal` never renders the target it was designed to name (MEDIUM).**
Its header (lines 3-7) says the prompt "names THE ACTION AND ITS TARGET"; `promptKey` encodes only the action, `targetRef` is sent to the API at `:59` and displayed nowhere, and the eight catalogue strings carry no `{target}` slot (`en.ts:190-197`). "Enter the code to reissue payment instructions for this order" — *which* order. This is the same failure M7 describes, already live rather than latent.

**4. `StepUpModal` is not modal (MEDIUM).**
`role="dialog" aria-modal="true"` at `:90` with no initial focus, no focus trap, no Escape handler, and a `role="presentation"` backdrop with no dismiss handler. Everything behind it stays tabbable. This is the dialog guarding payout changes.

**5. `ValidationSummary` hard-codes the sign-in screen's id prefix (LOW).**
`Feedback.tsx:55` — `href={`#signin-${e.field}`}`, inside a component every screen is meant to share. The second screen to use it gets dead anchors.

**6. D-96's own register text asserts something H2 disproves.**
`DEFECT-REGISTER.md` (D-96, Effect): *"an expired session 401s whatever the timer believed, and the 401 is handled (signed-out state, sign-in screen)."* It is not handled anywhere — the register carries the same false claim as `session.tsx:17-18`, which means the defect is currently signed off on a premise that does not hold. Worth correcting in the same change as H2.


---

## Lens: records -- skeptic's verdict

All 24 findings verified against the tree at `a633aec`. **24/24 CONFIRMED.** Evidence below, then 13 things the review missed.

---

# VERDICTS

**F1 — CONFIRMED.** `git log -1 --format=%B a633aec` contains "demonstrable at /dev/states". `apps/console/src/router.tsx` defines exactly `/sign-in`, `/`, `/s/:sellerId` (+`orders|products|inbox|more|*`), `/courier`. Recursive grep for `dev/states|/dev` over `apps/console/src` → zero matches. `StateDemo` is `{ index: true }` at router.tsx:30, inside `RequireSession` (:21) under `/s/:sellerId`.

**F2 — CONFIRMED, both halves.** `git diff --stat 25a6b1f..a633aec -- apps/console/CLAUDE.md` → empty. `git log -1 --oneline -- apps/console/CLAUDE.md` → `25a6b1f`. Grep of that file for `react-router|TanStack|Tailwind|RHF|Zod|stag` → only :34 and :106, neither about staging. `git ls-files docs/build-status/T7-REPORT.md` → empty (untracked), yet its line 192 says "Stack, recorded as staging (apps/console/CLAUDE.md)". `console.css:7` ("Recorded as a staging decision in the T7 report") therefore cites a file the commit does not contain.

**F3 — CONFIRMED.** `SignIn.tsx:44` `const requestKey = useIdempotencyKey()`; `idempotency.ts:15` `useRef<string>(mintKey())` — one key per *component* mount. "Change number" (SignIn.tsx:207-216) sets `setStep('phone')` only; the component never unmounts. Grep for `remint` across `apps/console` returns only its own definition in `lib/idempotency.ts` — never called. Server: `auth.controller.ts:83` routes `otp/request` through `runIdempotent`; `handler-transaction.ts:191-196` `actorFor` falls to `{kind:'DEVICE', id: x-adulis-device}`; `client.ts:51` sends the module-scoped `deviceId` on every request; `idempotency.ts:80-81` throws `IDEMPOTENCY_KEY_REUSED` on a hash mismatch. The record is written only inside a *successful* handler transaction (`handler-transaction.ts:154`), so the first request's record exists and the second number's hash differs → 409. Also confirms `otp/request`'s own `@ApiOperation` at controller:76: "a replay sends no SMS (X11)" — so the same-number path replays silently.

**F4 — CONFIRMED.** `en.ts:211` → `(register D-97)`. `am.ts:195` → `(መዝገብ D-96)`. DEFECT-REGISTER:971 (D-97 Effect) asserts the key cites D-97.

**F5 — CONFIRMED.** `Shell.tsx:37-38` inline comment says `(D-95)`; `Shell.tsx:10-11` docblock says `D-97`. D-95 is `core.device_platform` (DEFECT-REGISTER:943).

**F6 — CONFIRMED.** `IdleWarning.tsx:4` → `(D-93)`. DEFECT-REGISTER:921 → D-93 is the console build-output CI gate. `session.tsx:14` correctly cites D-96 (register :954).

**F7 — CONFIRMED.** Grep `StepUpModal` over `apps/console` → only `StepUpModal.tsx:2` and `:41`. Never imported, never rendered, on no route. Same for `stateFromProblem` (states.ts:59 only), `RouterFallback` (router.tsx:43 only), `SignedInBadge` (RequireSession.tsx:19 only).

**F8 — CONFIRMED.** Computed WCAG 2.x, sRGB linearised: `#1d4ed8` on `#ffffff` = **6.702:1**, not 8.6:1. Reviewer's other figures also reproduce exactly (textMuted 6.687, danger 6.470, success 5.016, warn 4.923).

**F9 — CONFIRMED.** `console.css:178` verbatim: `.remember input[type='checkbox'] { width: auto; min-height: auto; width: 1.25rem; height: 1.25rem; }` — 20×20px, `min-height` explicitly killed, first `width` dead. Grep for `min-height` in console.css returns only :44 (`button, input`), :75 (`100dvh`), :108 (nav links), :178 (the override). There is **no `.help` rule at all** in console.css, and `.skip-link` (:27-35) has no min-height.

**F10 — CONFIRMED, both clauses.** `contracts/openapi.json` path keys are `/v1/devices` and `/v1/devices/{id}`; there is no `/v1/auth/devices`. `auth.controller.ts:273` is `@Post('devices')`, and `auth.service.ts:325`'s own docblock reads `/** POST /v1/devices — anonymous registration; idempotent by id. */` — the register contradicts the code it cites. Enum: `0001_foundation.sql:148` `CREATE TYPE core.device_platform AS ENUM ('ANDROID', 'IOS');`; `0003:99` only declares `platform core.device_platform NOT NULL`. The `auth.service.ts:328-332` citation is accurate (signature 326, body 328, INSERT 330-333).

**F11 — CONFIRMED.** Case-insensitive grep `sign-out|signOut|signout|sign_out|logout` over `apps/api/src` → **no matches**. Contract auth keys: `otp/request`, `otp/resend`, `otp/verify`, `recovery`, `sessions`, `sessions/{id}`, `sessions/revoke-others`, `step-up/request`, `step-up/verify`. And `otp/resend` — a call the console actually makes — is absent from D-98's list.

**F12 — CONFIRMED.** `session.tsx:103-105` `onActivity` writes `lastActivity.current` and nothing else; only `touch()` (:86-89) clears `idleWarningAt`, and `touch` is called only from `IdleWarning.tsx:26`. `en.ts:198`: `'You will be signed out at {time} unless you continue.'` — an absolute time. `console.css:150-162` `.idle-warning { position: fixed; … z-index: 20 }`. ADU-CON-03 line 181 (§4.4) confirmed: "Deadlines are absolute and carry the timezone".

**F13 — CONFIRMED.** `SignIn.tsx:108` `remembered: remember` (local checkbox). `presentSession` (auth.controller.ts:185-207) returns `account_id, roles, expires_at, audience` — no `remembered`. `auth.service.ts:110-122`: a presented `__Host-adulis_device` cookie sets `accountDeviceId` regardless of `remember_device`; :145-149 then picks `console_remembered_lifetime` `WHEN accountDeviceId IS NOT NULL`. `client.ts:62` sends `credentials: 'include'`, so the cookie is always presented. *Narrowing:* the wrong value survives only until the next page load — `session.tsx:64-71` re-reads `remembered` from `GET /v1/auth/sessions` on boot (which is server truth, `auth.service.ts:194`). Still a real client-side derivation of a server-owned fact for the whole post-sign-in page session.

**F14 — CONFIRMED (substance); two cited line numbers are off.** `package.json:28` `"db:seed": "node ops/scripts/seed.mjs"` — no `--env-file-if-exists=.env`. Siblings that do carry it: `db:migrate` at **:23** (review says :25), `db:check` :24, `db:determinism` :26, `db:verify-extensions` :27, `verify:deferred-values` :38. `.env.example` defines `DATABASE_URL_MIGRATE` at **:46** (review says :47). `seed.mjs:22` prints the `cp .env.example .env` remedy that cannot work. The defect stands; the citations drift by 1-2 lines.

**F15 — CONFIRMED.** `Feedback.tsx:55` `<a href={\`#signin-${e.field}\`}>`. `ScreenState.tsx:76-77` routes `VALIDATION` through it. `StateDemo.tsx:43` passes `field: 'phone'` on a screen with no `#signin-phone` element.

**F16 — CONFIRMED, and self-evidently so.** `seed.mjs:69-70` says "without inventing eight numbers (D-61)". `0039_deferred_values_nullable.sql:54-64` drops NOT NULL on **ten** columns, and its header at :15-24 says in capitals: "TEN COLUMNS… D-61 says eight remain (it forgot demotion_window and distinct_buyer_window)… information_schema says: of S1.1's fourteen ladder columns, four are nullable and TEN are not." The seed, written in the same commit, repeats the number the migration exists to correct. The "omits fourteen" count also checks out: `core.ladder_config` (0002:201-229 + the two `new_to_established_*` columns) has 14 policy columns beyond the four the seed sets → 14 omitted.

**F17 — CONFIRMED.** `[regex]::Matches($openapi,'X-Adulis-Seller').Count` = **0** (as are `X-Adulis-Device` and `Idempotency-Key`). `/v1/seller` exists as the creation operation. The conclusion still holds — I checked the one candidate the review didn't mention, `/v1/sellers/lookup`, and it is `StorefrontController_lookup` (a `q` query-string storefront search, "Returns sellers only, capped, never suggests"), not "the caller's own sellers".

**F18 — CONFIRMED, but narrow it.** `schema.d.ts`: `AuthController_otpVerify` and `AuthController_sessions` both `requestBody?: never; responses: { 200: { headers…; content?: never } }` — absence is unverifiable there. **However** `BootstrapController_bootstrap` *does* carry `content: { "application/json": BootstrapResponseDto }`, and `BootstrapResponseDto` = `{client_status, feature_flags, locales, market, min_supported_client, server_time}`. So D-96's method is impossible for two of the three surfaces it names and entirely sound for the third.

**F19 — CONFIRMED.** `tokens.css` carries 10 colours, 1 font family, 6 spaces, 3 radii, 1 touch-min. `index.ts` additionally exports `font.size` (5), `font.weight` (3), `font.lineHeight` (2), `breakpoint.desktop`. `console.css` hard-codes `0.875rem` at :69, :70, :148 and `1024px` at :118.

**F20 — CONFIRMED.** `states.ts:63-64` verbatim: `if (p.status >= 500) return 'TRANSPORT_ERROR'; return 'TRANSPORT_ERROR';`. ADU-CON-03:125 defines `TRANSPORT_ERROR` as "Network or 5xx"; the §3 table (lines 113-126) has no branch for 401/403/404.

**F21 — CONFIRMED.** `client.ts:70-77` emits `code: 'NETWORK'`. Grep `NETWORK` over `apps/api/src` → **no matches** (the code is not in the catalogue). `en.ts:110` `'error.request.internal': 'Something went wrong on our side. Try again.'` — what a dropped connection renders.

**F22 — CONFIRMED.** `ScreenState.tsx:33` `<div className="skeleton" aria-hidden="true">`; `RequireSession.tsx:10` identical. Grep for `aria-live|role="status"|aria-busy` over `apps/console/src` returns `aria-busy` on three submit *buttons* only (SignIn:163, :197, StepUpModal:108) — no busy region, no live region, nothing on the loading path.

**F23 — CONFIRMED.** `Shell.tsx:20-26`/`:48-72` render five flat `NavLink`s in both navs; no expansion of More's sections anywhere. `router.tsx:34` maps `more` to `<Placeholder screen="More" />` inside the `<Shell>` element, i.e. inside the chrome.

**F24 — CONFIRMED.** ADU-CON-03:552 reads exactly "**No fixed heights** on any container holding translated text. Amharic runs longer and a fixed card clips it." Repo-wide grep for `30-50|30 to 50` (excluding node_modules/dist) returns exactly two hits: `console.css:12` and `apps/console/CLAUDE.md:68`. No source anywhere.

**Spot-check of the "hunted and refuted" list — the refutations hold.** Independent brace-free parse: `en.ts` 149 keys, `am.ts` 149, missing-in-am 0, extra-in-am 0, no duplicate keys, MT-KEYS.md 149 bullets. Re-reading `am.ts` as explicit UTF-8: 0 slot mismatches, 0 values identical to `en`, 0 values without Ethiopic (U+1200–U+137F). ADU-CON-03:111 is indeed the closed-set sentence `states.ts:5` cites. `otp.service.ts:198` `slots: { code, … }` confirms the `[FAKE SMS]` print really does surface the OTP.

---

# WHAT THE REVIEW MISSED

**M1 (MAJOR) — `/v1/bootstrap` is never called, and the values it carries are hard-coded instead.** `intl.ts:2-3` states the client formats "against the market timezone from `/v1/bootstrap` (ADU-CON-03 S4.4)". Grep for `bootstrap` over `apps/console/src` returns only comments — no fetch. `Shell.tsx:73` passes `timezone="Africa/Addis_Ababa"` as a literal; `IdleWarning.tsx:17` hard-codes `{ currency: 'ETB', locale: 'en' }`. `BootstrapMarketDto` in the *generated* contract is `{ code, display_currency, timezone }` and `BootstrapResponseDto` adds `locales` and `client_status` — every one of those values is typed and available. This is F13's rule violation (client-side derivation of a server-owned fact) with **no contract gap to park it behind**, and no register entry. Consequence beyond formatting: `UPGRADE_REQUIRED` — one of the twelve — is triggered by `client_status`, which nothing reads, so that state is unreachable outside `StateDemo`.

**M2 (MAJOR) — "Stay signed in" resets the idle clock even when the request failed.** `session.tsx:140-145`: `keepAlive` catches, rethrows **only** on 401, and otherwise returns normally. `IdleWarning.tsx:26` `keepAlive().then(touch, () => signedOut())`. So a 500, a timeout, or a dropped connection resolves the promise → `touch()` runs → banner cleared, `lastActivity` reset for another full idle period. `IdleWarning.tsx:6-7` asserts the opposite in prose: *"makes a real request -- server-side idle runs from the last REQUEST, so only a request resets it."* The seller is told they are safe; the server's clock never moved.

**M3 (MAJOR) — a transient boot error silently signs the seller out, and the error is destroyed.** `session.tsx:73-76` catches every failure of `GET /v1/auth/sessions` and does `void e`. `RequireSession.tsx:15` then `<Navigate to="/sign-in" replace />`. The comment claims "anything else also lands on the sign-in screen, which owns the error presentation" — but the problem object is discarded, never passed anywhere, and `SignIn` has no props. A 500 or a Wi-Fi blip on load is indistinguishable from an expired session: no `TRANSPORT_ERROR`, no retry, no request id. This is precisely the state contract F20/F22 circle without landing on.

**M4 (MODERATE) — the resend countdown hard-codes 30s against a 30→60→120 server ladder.** `SignIn.tsx:80` `setResendAt(Date.now() + 30_000)` after *every* successful resend. `otp.service.ts:139` `const backoff = [30, 60, 120][Math.min(row.n - 1, 2)]`. From the second resend on, the button re-enables at 30s while the server requires 60s (then 120s) → guaranteed `RATE_LIMITED` 429. Worse, `Feedback.tsx:28-33` *renders* `retry_after_seconds` but `SignIn` never feeds it back into `resendAt`, so the countdown restarts at 30s again. SignIn.tsx:12-13 claims the countdown "belongs to resend" — it belongs to the server's ladder, and the client invented a flat one.

**M5 (MODERATE) — the one deadline in the product carries no timezone.** ADU-CON-03:181: "Deadlines are absolute **and carry the timezone**." `intl.ts:15-21` `timeFormatter` uses `dateStyle:'medium', timeStyle:'short'` — `Intl.DateTimeFormat` emits no `timeZoneName` for either style. `IdleWarning.tsx:17-19` is the only consumer. The file's own docblock (`intl.ts:3`) cites §4.4 as its authority.

**M6 (MODERATE) — the mis-routed statuses also lose their mandated request id.** `Feedback.tsx:35` gates the request-id block on `status >= 500 || status === 0`. `states.ts:64` routes 401/403/404 to `TRANSPORT_ERROR`, and `ScreenState.tsx:85-93` renders that state through `ProblemBanner`. ADU-CON-03:125 and `Feedback.tsx:4` both require "**every** TRANSPORT_ERROR shows the request id in SELECTABLE text". For exactly the statuses F20 identifies as wrongly routed, the id is suppressed — a retry button with nothing for support to trace.

**M7 (MODERATE) — `Chooser`'s enabled submit does nothing, silently.** `Chooser.tsx:21,29` `if (valid) nav(...)` with `valid = UUID_RE.test(id)`. Paste a malformed id, press the button: no navigation, no message, no `aria-describedby`, no summary — only `aria-invalid` on the input (`:37`), which is colour/border alone. `SignIn.tsx:162` states the governing rule in the same commit — "Submit stays ENABLED so validation can be triggered (S15)" — and this is the screen where nothing is triggered. This is also the only screen a seller can reach after sign-in (D-97).

**M8 (MINOR) — `StateDemo`'s tablist is not a tablist.** `StateDemo.tsx:27-38` uses `role="tablist"` and `role="tab"` with `aria-selected`, but the `.demo-stage` div (`:39`) has no `role="tabpanel"`, no `id`, no `aria-controls` from any tab, and there is no roving `tabindex`. A screen reader announces twelve tabs controlling nothing. This is the artefact whose entire purpose is "twelve states demonstrable".

**M9 (MINOR) — a UUID is minted on every render.** `idempotency.ts:15` `useRef<string>(mintKey())` — the argument is evaluated on every render and discarded after the first. `SignIn.tsx:47-50` runs a 1-second `setInterval` calling `setNow`, so the sign-in screen calls `crypto.randomUUID()` twice per second for as long as it is open. Harmless, but it is the opposite of what the file's docblock ("keys are minted WHEN THE CONTROL MOUNTS") is trying to guarantee, and it is what made F3 easy to miss.

**M10 (MINOR) — `AM_ENABLED` does not exist.** The commit says "AM_ENABLED off". Repo-wide grep finds the identifier only in prose — four specs, two runbooks, `am.ts:16`, `MT-KEYS.md:5`, `generate-mt-keys.mjs:27`. There is no flag, no switcher, and no console file imports `am` (every console module imports `en` directly; `packages/locale/src/index.ts:2` exports `am` to nobody). "Off" is accurate only because the mechanism was never built.

**M11 (MINOR) — F2's dangling-citation problem has a second instance the review didn't catch.** `states.ts:57`: *"Recorded in the T7 report as a vocabulary tension"* — the same untracked `docs/build-status/T7-REPORT.md` that `console.css:7` points at. The 429→CONFLICT decision is therefore recorded nowhere on the branch, and it is a real vocabulary deviation (§3 defines `CONFLICT` as "409 from the API").

**M12 (MINOR) — `SessionInfo.accountId` is a lie after any reload.** `session.tsx:68` sets `accountId: ''` on the boot path because `GET /v1/auth/sessions` does not return it. Grep confirms nothing reads `session.accountId`, so it is latent — but it is a typed non-optional `string` that is empty roughly half the time, and the first consumer will get it wrong.

**M13 — extra evidence strengthening F10.** `auth.service.ts:325`'s own docblock reads `/** POST /v1/devices — anonymous registration; idempotent by id. */`. D-95's Source contradicts not just the contract but the very function body it cites two lines below.


---

## Lens: product -- skeptic's verdict

Verified against `adulis-platform` @ `a633aec` (branch `tier7/t7-phase-5-console`, base `25a6b1f`), PowerShell only. `git status` clean apart from the untracked `docs/build-status/T7-REPORT.md`; I rebuilt `apps/console/dist` (gitignored, `.gitignore:10`) and removed my one scratch file.

# Verdicts

## BLOCKER 1 — white screen, no checked-in config — **CONFIRMED**
Ran `npx vite build` in `apps/console` (succeeds). Bundle `dist/assets/index-*.js`:
```js
const jb="http://127.0.0.1:4010";function Hb(n){throw new Error(`API base URL is not configured…${jb}.`)}
const Bb=Hb(),Xy=crypto.randomUUID();
```
Offsets in the 310,334-char bundle: the `const Bb=Hb()` throw is at **286298**, `createRoot(...).render(...)` at **310236** — the throw runs first, unconditionally (terser folded the guard away). No route, no error boundary, blank page.
Config: `git grep VITE_API_BASE_URL` → only `.env.example:102`, `apps/console/CLAUDE.md:41-42`, `ops/scripts/seed.mjs:136` (a `#` comment), and the thrower itself. `apps/console` has no `.env*` (`Get-ChildItem -Force`). Repo-root `.env` exists but `Select-String -Pattern VITE` returns nothing, and it is out of scope anyway: vite 7.3.6 `dist/node/chunks/config.js:35609` — `envDir = config.envDir ? … : resolvedRoot` — and `vite.config.ts` sets neither `root` nor `envDir`. `git show 25a6b1f:apps/console/src/App.tsx` imports only `@adulis/locale`, so the regression is new. `pnpm -r build` still passes: this is a runtime death, so CI stays green over a dead artifact.

## BLOCKER 2 — "Change number" → 409 — **CONFIRMED**
`SignIn.tsx:44` `useIdempotencyKey()`; `git grep remint` → three hits, all inside `lib/idempotency.ts` itself, **zero callers**. `SignIn.tsx:207-213` resets `step`/`code`/`problem` only. Server: `handler-transaction.ts:140` `hashRequest(req.method, req.path, req.body)`, `idempotency.ts:43-50` folds `JSON.stringify(body)` into the sha256, `idempotency.ts:80-82` throws `IDEMPOTENCY_KEY_REUSED` on mismatch, `error-catalogue.ts:125` → **409**, `en.ts:102` → *"This retry key was already used for a different request."* `otpRequest` uses `runIdempotent` (`auth.controller.ts:83`); actor is `{kind:'DEVICE', id:<X-Adulis-Device>}` (`handler-transaction.ts:193-195`), stable for the page load. Deterministic.

## BLOCKER 3 — first-time seller can never sign in — **CONFIRMED**
`auth.service.ts:78-82` verbatim as quoted; `otpVerifyBody` (`auth.schemas.ts:26`) makes the field optional so zod does not catch it. `git grep -i "age_declared\|over_18\|over 18" -- apps/console packages/locale` → **no hits**. `git grep age_declared -- docs/build-status/DEFECT-REGISTER.md` → **no hits**, so it is genuinely unregistered. Rendered as `error.request.validation_failed` = *"The request is not valid."* (`en.ts:100`); the `slots.path` is never displayed. `seed.mjs:94` inserts `core.account`, which is why the demo loop passes.

## BLOCKER 4 — device row required — **CONFIRMED (code); "register understates it" is PARTIAL**
`auth.service.ts:95-99` as quoted, reached on both branches. `git grep devices -- apps/console` → **no hits**; `POST devices` (`auth.controller.ts:273`) demands `platform: 'ANDROID'|'IOS'` (`auth.schemas.ts:56`). One omission in the review: `client.ts:30-31` is `(import.meta.env.VITE_DEVICE_ID) ?? crypto.randomUUID()` — a dev escape hatch that BLOCKER 1 also leaves unset by any checked-in file. On "understates": D-95 (`DEFECT-REGISTER.md:945`) is already *"MAJOR (parked with a dev workaround; production console sign-in cannot register a device truthfully)"* and its Effect names the production browser. What it does **not** say is that verify returns **400 outright** — it frames the loss as remember-device. That narrower point stands.

## BLOCKER 5 — idle warning cannot fire for an active seller — **CONFIRMED, and worse**
`session.tsx:94-113` as quoted. Server clock: `common/auth/session.service.ts:115-117` touches `last_activity_at` only from `authenticate()`, i.e. only on an authenticated request; `:89-91` picks `console_remembered_idle` on `account_device_id IS NOT NULL`. `git grep "api<\|api("` gives **7** call sites, not five (`SignIn` 61/79/97, `StepUpModal` 56/76, `session` 64/142) — none fires from navigation. `IdleWarning` is mounted only at `Shell.tsx:73`, so `/` and `/courier` have none. Sharper than the review states: because the console issues no requests after boot, the seller is not merely un-warned — the server-side session silently idles out while a fully interactive shell keeps rendering, and nothing discovers it until a reload.

## MAJOR 6 — remembered-ness from the checkbox — **CONFIRMED**
`SignIn.tsx:108` `remembered: remember`. `auth.service.ts:110-122` sets `accountDeviceId` from the presented `__Host-adulis_device` cookie **before** and independently of `remember_device` (`:123`). `presentSession` (`auth.controller.ts:189-206`) returns `{account_id, roles, expires_at, audience}` — no remembered flag. `listSessions` (`auth.service.ts:194`) does compute `(s.account_device_id IS NOT NULL) AS remembered`, and `session.tsx:64-71` reads it at boot only.

## MAJOR 7 — sticky warning, rotting timestamp — **CONFIRMED**
`session.tsx:97-102` has no `else` branch; `touch` (`:86-89`) is called only from `IdleWarning.tsx:26`. The effect deps are `[session]`, so the interval closure never re-arms after activity.

## MAJOR 8 — splat catch-all renders nothing — **CONFIRMED, empirically**
I ran react-router 7.18.3 in-process (memory router, same route shape, `useResolvedPath('.')` inside the splat):
```
location=/s/11111111-2222-3333-4444-555555555555/orders/123 | resolveTo(".")=/s/11111111-2222-3333-4444-555555555555/orders/123
```
`to="."` is the identity inside a splat, so `router.tsx:35`'s `<Navigate to="." replace />` is a no-op that renders `null` into Shell's `<main>`. `Navigate` (`chunk-BV7QT456.mjs:7086-7118`) keys its effect on `jsonPath`, so no loop — the review's own refutation holds. Suggested fix (`to=".."` + `relative="path"`, or absolute) is correct.

## MAJOR 9 — deep links do not resume — **CONFIRMED**
`RequireSession.tsx:15` `<Navigate to="/sign-in" replace />`, no `state`/`location`; `SignIn.tsx:109` `nav('/', {replace:true})` unconditional. Spec text verified: ADU-CON-03:105 — *"an unauthenticated deep link lands on SC-00 and resumes after sign-in."*

## MAJOR 10 — StepUpModal unreachable; 401/403 → "Try again" — **CONFIRMED**
`git grep StepUpModal` → 2 hits, both inside its own file. `git grep stateFromProblem` → 1 hit, its own definition. `git grep retryable -- apps/console` → the type field, a literal in `client.ts:76`, a literal in `StateDemo.tsx:18`; never read. Statuses check out against `error-catalogue.ts` (401 at :52-53, 403 at :58/:63-64, 404 at :138), and `stateFromProblem`'s fallthrough sends all of them to `TRANSPORT_ERROR` → `ScreenState.tsx:85-93`'s unconditional retry button.

## MAJOR 11 — no sign-out — **CONFIRMED**
`git grep "signOut" -- apps/console` → nothing; `signedOut` exists only as the local state setter (`session.tsx:125`) called once from `IdleWarning.tsx:26`. `common.signOut` (`en.ts:28`, `am.ts:32`) has no consumer. `Shell.tsx:44-46` account button has no `onClick`.

## MAJOR 12 — false reassurance offline — **CONFIRMED**
`session.tsx:140-146` rethrows only on 401; `IdleWarning.tsx:26` `.then(touch, …)` runs `touch()` on the resolved (swallowed) path.

## MAJOR 13 — resend countdown contradicts the ladder — **CONFIRMED, and the numbers are worse than stated**
`SignIn.tsx:67,80` both `Date.now() + 30_000`. `otp.service.ts:136-145`:
```ts
if (row.n >= 3) throw new AdulisException('RATE_LIMITED', { slots: { retry_after_seconds: 900 } });
const backoff = [30, 60, 120][Math.min(row.n - 1, 2)] as number;
```
The `>= 3` guard runs first, so **index 2 (`120`) is unreachable**: 1st resend 30s (matches), 2nd 60s (client says 30 → 429), 3rd is a **900-second** block, not 120. `problem-details.filter.ts:47-50` sets `Retry-After` and the envelope carries `slots.retry_after_seconds`; neither feeds the countdown.

## MAJOR 14 — `X-Adulis-Seller` never threaded — **CONFIRMED**
`client.ts:55` is the only writer; none of the 7 `api()` calls passes `sellerId`. `Shell.tsx:29` uses `useParams().sellerId` for hrefs only. Guard confirmed at `auth.guard.ts:154-156` (`SELLER_CONTEXT_REQUIRED`, 400 per `error-catalogue.ts:132`).

## MAJOR 15 — non-`ApiError` swallowed — **CONFIRMED**
`client.ts:59-66` wraps only `fetch`; `:80-81` `await res.text()` and `JSON.parse` are outside it. Every catch site is `if (e instanceof ApiError)` (`SignIn.tsx:69,82,111`; `StepUpModal.tsx:63,82`), and each `finally` clears `busy` — silent dead button. Note `res.text()` rejecting mid-body is uncaught for the same reason.

## MINOR 16 — T7-REPORT claims — **ONE CONFIRMED, THREE REFUTED, ONE PARTIAL**
- `/dev/states` — **CONFIRMED.** `T7-REPORT.md:144-145` and `:154-155` (*"the `/dev/states` route is the demonstration"*, offered in lieu of screenshots); `router.tsx` defines no such path. The demo is the index route of `/s/:sellerId`, behind a session and a pasted uuid.
- *"intl.ts: the three clock treatments in one module"* — **REFUTED.** No such sentence. `T7-REPORT.md:182-186` says the opposite: *"**Rule 3** asks for three clock treatments; C-1/C-2 display exactly two … so the third has no surface to land on."*
- *"handoff-role items render disabled, not hidden"* — **REFUTED.** `:179-182` explicitly declines to claim rule 4.
- *"payment decisions equally weighted; evidence blob URLs revoked"* — **REFUTED.** `:176-179`: *"Four could not be exercised, and I am not claiming them: rule 5 … and rule 9 … have NO surface in C-1/C-2."* The sub-claim that `lib/blob-viewer.ts` is *"required by `apps/console/CLAUDE.md:95`"* is also wrong: line 95 is the console's eventual `src/` tree (alongside `admin/ SC-24..SC-29`, `trust/`, etc.), not a C-1 deliverable.
- seller-scoped read (`:162`) — **PARTIAL.** MAJOR 14 proves the console cannot emit that request; whether a hand-run curl did is not decidable from the repo. State it as "not reproducible from the console", not as a fabrication.

## MINOR 17-21 (a11y) — **ALL CONFIRMED**
- `console.css:178` verbatim, including the duplicate `width` (`width:auto` then `width:1.25rem`); `min-height:auto` overrides `button, input { min-height: var(--adu-touch-min) }` at `:42-45`. `SignIn.tsx:159`'s `.hint` has no `id` and the checkbox no `aria-describedby`.
- `StepUpModal.tsx:89-90`: no focus code of any kind in the file — no `useRef`/`focus()`/`keydown`/Escape/restore.
- `StateDemo.tsx:27-37`: `role="tablist"`/`role="tab"`, no `tabpanel`, no `aria-controls`, no roving `tabindex`, no arrow keys.
- `Feedback.tsx:55` `href={`#signin-${e.field}`}`; `StateDemo.tsx:43` passes `field:'phone'` → dead `#signin-phone`. Spec §15 (line 577) requires *"a summary of links that focus each invalid field"*.
- `Chooser.tsx:29` `if (valid) nav(...)` with no else; `:37` `aria-invalid` with no message, no `aria-describedby`, and `console.css:67` styling by border colour alone.

## MINOR 22 — EMPTY/VALIDATION/CONFLICT vs §3 — **CONFIRMED**
Spec §3.2 (line 134) and the state table (lines 122-123) verified verbatim. `ScreenState.tsx:39-44` is one `<p>` with no action prop; `:76-77` renders the summary only; `:74-75` renders `ProblemBanner` only. `AdulisProblem.items` (`states.ts:38-43`) is never read anywhere in `apps/console/src` — and Zod 400s are exactly where the API puts per-field detail (`problem-details.filter.ts:62-69`).

## MINOR 23 — token drift; dead TS entry — **CONFIRMED (one number wrong)**
`tokens.css` carries colour/space/radius/touch and omits `font.size`, `font.weight`, `font.lineHeight`, `breakpoint` from `src/index.ts:42-44,62-65`. `0.875rem` appears **3** times, not four (`console.css:69,70,148`); `1024px` once (`:118`). `git grep @adulis/tokens` shows the only code import is `main.tsx:4` `'@adulis/tokens/tokens.css'` — `src/index.ts` has zero importers.

## MINOR 24 — citation drift — **TWO CONFIRMED, ONE MISATTRIBUTED**
- `Shell.tsx:38` cites D-95 for the sellers-list gap; the register's D-97 (`DEFECT-REGISTER.md:965`) is the sellers-list entry, D-95 (`:943`) is `device_platform`. **CONFIRMED.**
- `am.ts:195` cites `D-96`, `en.ts:211` cites `D-97`. **CONFIRMED.**
- `Shell.tsx:39` *"SC-26's unread count"* — **the code is transcribing the spec.** ADU-CON-03:86 itself says *"notification bell with unread count (SC-26)"*, while :204 places the notification centre at SC-30 and :495 makes SC-26 Subscription. The inconsistency is upstream in the spec; this diff copied it faithfully.

## MINOR 25-28 — **ALL CONFIRMED as fact**
`intl.ts:15-21` has no `timeZoneName`; spec §4.4 (line 181) verified. `/sign-in` sits outside `RequireSession` (`router.tsx:19`) with no signed-in guard. On a 429 `Feedback.tsx:27` renders `error.request.rate_limited` (*"Too many requests. Try again in {retry_after_seconds} seconds."*) and `:30` adds `console.signin.rate_limited` (*"Too many attempts. You can try again in {seconds} seconds."*). `opts.locale` has no caller; `git grep AM_ENABLED` finds it only in docs, comments and `MT-KEYS.md` — true, though with no language switcher built, "AM_ENABLED off" is descriptive rather than defective.

## "Hunted and refuted" — all thirteen re-checked and **all hold**, with one caveat
Spot-verified: `auth.controller.ts:165-180` records the verify key only inside the successful transaction; `Navigate`'s `jsonPath` dep (proved above); `tsc --noEmit` + `eslint apps/console/src` + `vite build` all clean; `git grep localStorage\|sessionStorage\|indexedDB -- apps/console packages/tokens packages/locale` → two prose hits; the only `height:` declarations are `.skeleton-row` and the checkbox; `en.ts`/`am.ts` both hold exactly **149** keys (`^\s+'[A-Za-z][\w.]*':`) matching MT-KEYS' 149; `configure-app.ts:23-37` allows all four custom headers with `credentials:true` against an exact origin; `X-Adulis-Client` appears only in that allowlist; `resolveApiBaseUrl` rejects a versioned base and `configure-app.ts:15` sets the single `v1` prefix; the auth bodies match `auth.schemas.ts`; `StepUpModal.tsx:48` `useState(mintKey)` is the correct idiom; `otp.service.ts:198` puts `code` in slots and `sms.adapter.ts:48` logs `message.slots`.
**Caveat on rule 8:** "generated from `en.ts` so it cannot drift" is overstated. `git grep "generate-mt-keys\|MT-KEYS" -- ops .github` → **no hits**: nothing regenerates or verifies it in CI, and the generator's `^ {2}'([^']+)':` never reads `am.ts` and would mis-parse a key containing an apostrophe. It can drift silently; it just hasn't yet.

---

# What the review missed

1. **Re-requesting the *same* number silently sends no SMS.** The mirror of BLOCKER 2, and it fails in the direction nobody debugs. "Change number" → retype the same phone → same `requestKey`, same body → `idempotency.check` matches the hash → `handler-transaction.ts:143-147` replays the stored 202 with `X-Adulis-Idempotent-Replay: true` and **`otpRequest`'s `toSend` stays null (`auth.controller.ts:82,105`), so no SMS is dispatched**. The console advances to the code step and starts a 30-second resend countdown for a code that was never sent.

2. **The console never calls `/v1/bootstrap`.** All 7 `api()` call sites are `/auth/*`. Three things in this diff assume it: `intl.ts:1-7` (*"against the market timezone from `/v1/bootstrap`"*), `states.ts:24` (`UPGRADE_REQUIRED` = *"client below the `/v1/bootstrap` floor"*), and the only deadline the console renders. `Shell.tsx:73` hardcodes `timezone="Africa/Addis_Ababa"`, and `IdleWarning.tsx:17` hardcodes `locale:'en', currency:'ETB'` — the market context is a literal, not a fetch, and `UPGRADE_REQUIRED` can never be reached.

3. **`IdleWarning.tsx:4` cites D-93** — the console build-output CI gates (`DEFECT-REGISTER.md:921`) — where it means D-96, which `session.tsx:14,16,24` cites correctly. Same class as MINOR 24, missed.

4. **The boot state is invisible to a screen reader.** `RequireSession.tsx:9-13` renders the skeleton with `aria-hidden="true"` and nothing else — no `aria-busy`, no live region: an AT user gets a completely empty document for the whole boot probe, and permanently if it hangs. `ScreenState.tsx:29-31` repeats the pattern with a comment claiming *"the loading state is announced by the busy region"* — `git grep aria-busy` shows the only three are on submit buttons; no such region exists.

5. **`@keyframes shimmer` (`console.css:137,140`) runs infinitely with no `prefers-reduced-motion` guard** — `git grep prefers-reduced-motion -- apps/console` is empty. ADU-CON-03:577 lists *"reduced-motion respected"* in the same §15 sentence as the 44px targets the review does cite, so this is a spec violation, not a nit.

6. **`useIdempotencyKey` mints a fresh uuid on every render.** `idempotency.ts:15` is `useRef<string>(mintKey())` — the argument is evaluated each render and thrown away. Harmless today, but it is the exact bug `StepUpModal.tsx:48`'s `useState(mintKey)` avoids, in the helper that exists to make the rule uniform.

7. **Duplicate announcement on validation.** `SignIn.tsx:146,193` give each field error `role="alert"` *and* wire it via `aria-describedby`, while `Feedback.tsx:50`'s summary is a second `role="alert"` — submitting an invalid phone announces the same sentence twice.

8. **`Chooser` opens the shell for any well-formed uuid** (`Chooser.tsx:21,29`) with no server round-trip. Combined with MAJOR 8, a typo'd store id yields a fully-rendered nav over a store that does not exist, and every link under it lands in the empty `<main>`.

9. **Register path drift:** D-95's Source (`DEFECT-REGISTER.md:947`) cites `POST /v1/auth/devices`; the route is `@Post('devices')` under `@Controller()` with global prefix `v1` (`configure-app.ts:15`), i.e. `POST /v1/devices`.

**Net:** of 28 findings, 24 confirm outright, 3 are partly wrong on attribution or severity (BLOCKER 4's "understates", MINOR 24's SC-26, MINOR 16's `/dev/states` sibling claims), and MINOR 16 contains four assertions that the T7 report explicitly does not make — which is the review's own weakest section, since it accuses the report of claiming precisely the four things it lists as unclaimable.
