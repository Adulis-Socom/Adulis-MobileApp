# ADU-RUL-03 -- The Three Console Blockers, and the Guard That Was Never Armed

**Version:** 1.0 - **Baseline date:** 28 August 2026
**Owner:** Founder / CEO
**Status:** Binding. Unblocks D-101, D-102, D-104. Adds one class finding and two rules.
**Encoding:** ASCII.

---

## 1. D-105 -- `NODE_ENV=production` is set nowhere, so every guard on it is a no-op

**The `[FAKE SMS]` defect is one instance of a class and the class is the finding.**

`console.warn` bypasses the Pino redaction allow-list entirely. **ADU-CON-02 S20.2's guarantee -- fields are logged because they were named -- held only for code that used the logger**, and nothing prevented any module writing a phone number and a live OTP straight to stdout. The allow-list was a control over one code path, described as a control over logging.

**And the guard inverted for a reason that generalises.** `ops/render.yaml` does not exist (D-80). **Nothing in this repository sets `NODE_ENV=production`** -- so every `NODE_ENV === 'production'` check in the codebase is currently a no-op, including **Work Order T7 S3.2's own rule** that each fake adapter must refuse to run in production. I wrote a rule that depends on an environment nobody sets.

> **RULING -- two changes, and the second is the one that matters.**
>
> **1. A lint rule bans bare `console.*` in `apps/api`.** The logger is the only egress. A redaction allow-list that any module can walk around is not an allow-list.
>
> **2. `NODE_ENV` is asserted at boot, not consulted at a call site.** The API reads it once at startup, validates it against a closed set, and **refuses to start if it is unset.** A service that cannot determine its environment must not pick the permissive default -- which is exactly what happened here, and the permissive default was "print OTP codes".

**Every existing `NODE_ENV` guard is now suspect and should be re-read**, not because each is wrong but because none has ever been exercised in the branch it guards.

---

## 2. D-102 -- the device identity is server-minted, and the client never generates one

**Neither arm works, which is the correct reading:** `VITE_DEVICE_ID` set gives a build-time constant every browser shares, defeating the new-device payout lock; unset gives a per-load uuid with no `core.device` row, and verify 400s before sign-in. **There is no configuration in which the console can both sign in and preserve the lock.**

> **RULING -- `/v1/bootstrap` mints the device.** The server creates the `core.device` row (with its market, per G1.11) and returns a device identifier in an **httpOnly `__Host-` cookie**. `VITE_DEVICE_ID` is removed. **The client never generates, stores or reads a device id.**

**Why a cookie and not `localStorage`.** A device id is an identifier, not a credential, so rule 6 does not forbid it on its face -- but **a value JavaScript can read is a value XSS can forge**, and this one gates the payout lock. httpOnly removes both the reading and the forging, and it costs nothing because the client has no reason to read it.

**Why the server and not the client.** A client-minted id has no row behind it until something creates one, which is precisely the second arm's failure. **The row and the identifier are created by the same act**, so the identifier cannot exist without its row.

**It is a separate cookie from R17's `__Host-adulis_device`.** That one is opt-in, revocable and selects a session lifetime. This one is always present and identifies the browser. **Two facts, two cookies** -- collapsing them would make forgetting a device also forget it is the same device.

---

## 3. D-104 -- identity creation takes the market from the device, not from a lookup

**The unordered `LIMIT 1` is the symptom.** `auth.service.ts:84` and `otp.service.ts:90` both `WHERE is_live LIMIT 1` with no `ORDER BY`; a second live market broke a green 430-test suite. **Adding an `ORDER BY` would make it deterministic and still wrong** -- it would deterministically pick a market for a person whose market nobody asked about.

> **RULING -- there is exactly one place a market is chosen, and it is `/v1/bootstrap`.** Identity creation reads the market **from the device row** that bootstrap already resolved. **The two `WHERE is_live LIMIT 1` lookups are removed, not ordered.**

This coheres with G1.11 -- devices are assigned a market at first bootstrap -- and it removes the ambiguity rather than ranking it. **D-20's warning that the single-market assumption is "loudly wrong the day a second market goes live" stops being a warning**, because there is no longer a second place making the assumption.

**Bootstrap's own resolution keeps its deterministic ordering and its comment.** One place, still provisional, still flagged.

---

## 4. D-101 -- the age declaration, and the first string MT cannot cover

`auth.service.ts:78` requires `age_declared_over_18 === true`; the console never asks. **A person with no account cannot sign in**, which makes this the blocker it is.

> **RULING -- the declaration is an explicit affirmative act at first sign-in, never pre-checked, recorded with `age_declared_at`.**
>
> **English, verbatim:** *"I confirm that I am 18 years of age or older."*
>
> **Refusal, verbatim:** *"Adulis is available to people aged 18 and over. You cannot create an account at this time."*
>
> **No third option, no "prefer not to say", and no way to proceed without the affirmative.** The declaration is the whole control.

**And a rule this exposes, which applies to nothing else in the catalogue yet:**

> **INVARIANT -- a machine-translated placeholder is not acceptable for a string a person is legally bound by.** Every other string in `am.ts` ships MT and improves later. **This one does not.** A person cannot attest, in a language they read, to a sentence nobody has checked -- and an attestation whose wording was never verified is not evidence of anything.

**Consequence, and it is small:** `AM_ENABLED` stays off, which it already is. **Mark this key in `MT-KEYS.md` as `HUMAN-REQUIRED`**, so the translation pass treats it as a gate rather than an item. It is the first entry in a class that will grow -- terms acceptance, the seller agreement, the payout authorisation.

---

## 5. Two rules from the report fact-check

### 5.1 A claim of verification names its instrument

**Sixteen false or overstated claims in one report is a signal, and one of them is mine.**

`"renders at 1280 and 360: yes"` is a field **I put in the report template**, and no agent can answer it honestly without a browser. I asked for a verification you had no instrument to perform, and the field produced the answer it invited.

> **RULING -- a report claim asserting verification names the command, file or artifact that produced it.** *"430 tests"* cites the runner. *"Renders at 360"* cites a browser or a screenshot, **or it is not claimed.**
>
> An unsourced "yes" in a report is the same failure as an appendix asserting a schema it never checked. **I have committed that four times in documents; this is its first appearance in a report, and the fix is the same one.**

**`State of main` becomes the ref**, not an adjective. `95f809a (PR #23) -- Phase 5 unmerged` says what `clean` obscured.

### 5.2 The build gates have no opinion about whether the artifact boots

**A blank page passed every gate.** Gates 17 and 18 inspect the bundle for `unsafe-eval` and for production React; **neither has any opinion about whether the thing runs.**

> **RULING -- a boot smoke test joins the gate list.** Serve `apps/console/dist`, load it headless, assert the root element has children and no uncaught error reached the console. **The cheapest possible assertion, against the failure that every other gate is structurally unable to see.**

This is the fourth member of the family: `exclude` dropping the module from the dependency graph, the comparator with NUL keys on both sides, `ci:local` diverging from CI, and now build gates that cannot see a build that does not start. **Each time the check could not fail rather than did not.**

---

## 6. What I owe

**ADU-DB-01 v1.13**, from Phase 2's generated appendices -- with the fixture's own `_provenance` corrected: it says *"66 types, 230 values"* while holding 233, and the report cites the fixture as the authority.

**ADU-REPO-01 v1.3 and ADU-CON-02 v3.2** -- the ownership model. `CODEOWNERS` is fixed in the repository and the documents still describe two founders.

**ADU-VAL-01 v1.2** -- whatever Phase 3's gate found when S1.1's list met the schema.

---

*Four rulings and two rules. The one worth carrying is D-105: a redaction allow-list that only governs one code path was described as governing logging, and a guard on an environment variable nobody sets was described as a guard. Both were true as written and false in effect -- which is the shape this project keeps finding, and the reason the answer is always the same: assert the condition at a boundary rather than consult it at a call site.*