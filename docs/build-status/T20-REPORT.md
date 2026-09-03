# T20 REPORT - Finish the Build, Then Draw It

**Order:** T20 - "Finish the Build, Then Draw It"
**Documents installed this order:** ADU-AUTH-01 **v2.7**, ADU-API-01 **v1.11**
**Gates:** `pnpm ci:local` -- **all 27**, green, including one added here.

---

## The answer first

**The build is finished. The design is not started, and cannot be started from
this machine.**

That is the split the order itself anticipated:

> "If the window runs short, the build wins. A seller cannot put a photograph on a
> product, and that is the last fatal item on BETA-READINESS. A beautiful design of
> a console nobody can use is worth less than an ugly console somebody can."

The window did not run short. **S7 is blocked by something outside this
repository** -- see the last section, which is the one thing here that needs the
founder rather than an engineer.

| | | |
|---|---|---|
| **S2** | Merge #83 and the gate that could not see it | **Done** -- and the ruling's premise was refuted by evidence |
| **S3** | The courier link in the switcher | **Done** (merged, PR #84) |
| **S4** | Media, complete, against real object storage | **Done** -- the last fatal item that was an engineering task |
| **S5** | The IN_APP producer | **Done** |
| **S6** | Documents, the payout job, the surface gate, dark mode | **Done** |
| **S7** | Design the console in Figma | **BLOCKED** -- no edit access, and a seat capped at 20 tool calls per month |
| **S9** | Two reports | This, and `T18-REPORT.md` |

---

## S2 - the CI ruling, refuted rather than implemented

S2.1 ruled that CI runs on push to `main`, "not only on `pull_request`", and that
"the workflow has every step already; only the trigger changes."

**The premise was wrong, and implementing the change would have been a no-op that
looked like a fix.** `.github/workflows/ci.yml` already carried
`push: branches: ['**']`, which has always included `main`. The Actions history
proves the workflow ran on exactly the merges in question:

```
2026-09-03T07:12:26Z  failure  push  6201c1e4  Merge pull request #81
2026-09-03T07:10:02Z  failure  push  139baca3  Merge pull request #80
```

**The gate saw the merged tree. Nobody looked at the gate.** That is a different
failure with a different fix, so the fix is a different one: a main-branch CI badge
at the top of `README.md` with one sentence under it -- *if that badge is red, main
is broken and fixing it precedes every other task*. The trigger gained a comment
explaining why it is already correct, so the next reader does not re-derive this.

Branch protection remains the stronger fix and remains unenforceable on this plan
(ADU-CON-02 S21).

**And the merge itself hid a worse thing.** Origin's hand merge of #83 had spliced
**67 lines of D-241's body into the middle of D-244** -- no duplicate headings, no
broken markdown, nothing a reader would notice. It was found only by the S1.2
multiset check, repaired, and the repair proven a pure permutation: **non-blank
lines lost 0, added 0.**

---

## S4 - a seller can put a photograph on a product

**This is the item the order called fatal, and it is closed against a real object
store rather than against a fake.**

`apps/api/src/common/adapters/s3-object-storage.ts` is **one class implementing both
`MediaStorageAdapter` and `FinancialStorageAdapter`**, bound twice under two sets of
values. The order's own test of correctness is met: switching between MinIO and
Cloudflare R2 changes six environment variables and **no code**. That equivalence is
the only reason a MinIO run says anything about R2, and it is recorded as a claim
with a limit (D-249) rather than as a result.

**No credential is in this repository, this commit, or this report.**

### What the pass caught in my own work

- **The cap was checked in the wrong place** (D-251). REQUEST_UPLOAD signed three
  PUTs without counting, so a seller adding a sixth photograph would have resized
  it, uploaded three derivatives over a mobile connection, and *then* been refused.
  The bytes are the expensive part and they were spent before the refusal.
- **And the register entry recording that fix was itself imprecise** (D-263). It
  implied a second count at COMMIT. There is none, and there should be none: the cap
  is `CHECK (position BETWEEN 1 AND 5)` plus `UNIQUE (product_id, position)` -- *"five
  positions, five rows, no counting logic anywhere"*, in migration 0007's own words.
  The pre-mint count is a courtesy, not the cap.
- **The key carried a position** (D-250), making the object's *name* a copy of a
  column that reordering changes. Dropped per S4.4.
- **CSP and bucket CORS produce one symptom from two systems** (D-252). Made
  distinguishable: the page records `securitypolicyviolation` and names the wall in
  the thrown message.
- **The contract described none of these bodies** (D-98's class). Added and
  regenerated, so the console stops typing the shapes locally.

### The proof

Not a passing unit test. A browser and a real file:

```
WALK [OK] step 5: a photograph uploads from the browser and renders on the product
```

with the objects in the bucket under opaque, position-free keys, and the rendered
`<img>` reporting `naturalWidth > 0`. `SC-10 media` covers the rest of S4.5:
storefront API response, delete, drag reorder, and a sixth image refused **before**
any upload begins.

**BETA-READINESS fatal item 3 is marked CLOSED** with that proof. The finding is kept
as written -- it is what the walk found -- and what changed is recorded beneath it.
**The answer to that document's question is still no**: no buyer can see the store,
so this is a photograph on a product nobody can visit.

---

## S5 - the notification that reached nobody

`NullPushAdapter` returned `RETRYABLE`, which is a claim about a **transient**
failure. With no provider bound the failure is permanent, so every PUSH notification
burned its full backoff and landed in `FAILED` -- silence with a retry count beside
it. **Four templates are PUSH-only**, and one of them costs money:
`notification.chat.escalated`, where a buyer asks what the assistant cannot answer,
it escalates, and the seller never learns.

`NO_PROVIDER` is a fourth outcome and a fact about the **platform**, not about the
device (`TOKEN_DEAD`) or the network. The job then **moves** the row to `IN_APP`
rather than inserting a twin -- `notifications.controller` does not filter by
channel, so a copy would appear twice in the seller's list. A bound provider
returning `RETRYABLE` still fails, asserted separately, so the fallback cannot
swallow a real transport failure (D-253).

---

## S6 - the documents, the job, the gate, the mode

### S6.1 - the question was answered, not assumed

The order asked directly: *does a failing `GET /v1/seller/payout` roll back an
activation it just performed?*

**Yes. It is D-74's twin and it has been in 0022 since Tier 3** (D-255).
`financial.service.ts` runs `fn_activate_due_payout` inside the handler's
transaction. It is **registered, not fixed** -- the fix is a decision about the read
path, and that is a ruling, not a build task. **A ruling is requested.**

The new job is immune by construction: one statement, one transaction, per seller,
with nothing after it to fail. Per-seller containment is the requirement rather than
a nicety -- the ownership-transfer activation had none, so one raise stopped the
sweep platform-wide.

**And it closes T18's worst open item.** D-241 recorded that the cancel-then-set
takeover window "is not 24 hours; it is *until the seller next looks*." That sentence
is now true as written.

**A defect in what I had just built, fixed in the phase** (D-256): the job first went
into `E5_JOBS`, which turned "exactly the twenty jobs S24 names, and no others" into
twenty-one. Editing the 20 to a 21 would have destroyed the only thing that assertion
was for. `RULED_JOBS` holds jobs from other documents; the heartbeat was always
outside the list for the same reason and is the precedent. That in turn exposed
D-257: the heartbeat was publishing the size of a *transcription* rather than the
number of jobs it runs. The two had been equal since it was written, which is why
nobody noticed the wrong one was published.

### S6.2 - the gate found three, and none where the ruling looked

ADU-AUTH-01 v2.7 S26.4 asked for a gate comparing S12's surface markers to
`core.permission.surfaces` in both directions, naming analytics overview as the case.

**The direction v1.11 anticipated is clean.** No `M` marker over-promises; nothing
claims mobile reach the database refuses.

**The other direction was not** (D-258). Three permissions are granted on `MOBILE`
with no marked endpoint -- `seller.reviews:read`, `seller.analytics.basic:read`,
`seller.notifications.preferences:write`. Nobody is broken today, **which is exactly
why it survives**: the day someone builds the mobile screen, the review that should
have questioned the grant has already happened and concluded nothing. v1.11 was right
that it was wrong, and wrong about how many.

Per S26.4 the grant governs, so **three markers are corrected and no grant is
touched**. The gate is proven to fire in both directions by planting each violation
and observing red. **A marked row whose permission cannot be resolved is a failure,
not a skip** -- a reader that silently drops what it cannot parse is a gate that goes
green by not looking.

Cite it by name: **`surface-markers`**. It is appended, like the two before it,
because ADU-RUL-03 S5.2 cites gates by position in a document this repository does
not edit.

### S6.3 - dark mode, and what auditing for it found

The mode itself is small: the dark blocks redefine only the **ramp and the hues**,
because the role properties are declared once as `var()` references. A role added
later therefore cannot be forgotten in a mode -- there is no per-mode list to forget
it in. There are **three blocks, not one**, because a theme has three states and only
two are usually written; without the explicit `[data-theme='dark']` block a toggle
works in one direction only, which is the bug that reproduces for nobody else.

**The audit before it was the valuable part** (D-259). `console.css` referenced
`var(--color-border, #d4cec4)` and six more names in a convention this repository
never adopted -- **57 usages of variables that do not exist anywhere**. Every one had
a fallback, so every one silently rendered the literal, passed every gate, and would
have stayed light while the rest of the page inverted. **A fallback is what makes
this class invisible**: without it the layout collapses and somebody fixes it the
same day.

One of the seven had no token to bind to. `--space-3` (12px) was used **twenty-two
times** against a 4px scale that ran 4, 8, 16. Twenty-two authored uses of a value is
evidence the scale was missing a step, so `space.smd` closes it.

---

## S7 - BLOCKED, and this is the part that needs you

**Nothing was drawn. Nothing was faked.** No partial file was created in a drafts
folder to show progress -- a design in the wrong file is not the design the order
asked for, and would have spent a fifth of the monthly call budget proving it.

There are **two independent blockers, and clearing either one alone is not enough**
(D-262):

**1. No edit access to the file.** `get_metadata` on `FneEVVjS5zjOA03NrVu4Rs`
returns:

> "Looks like you don't have edit access to this file. The file owner can share it
> with you and make you an editor."

Every write tool needs edit rights, and so does renaming the file from `Untitled`
(S7.1).

**2. The seat cannot afford the work even with access.** `whoami` reports one plan:
*Abenezer Mekonnen's team*, tier **Starter**, seat **View**. Figma's published limits
put a View seat on Starter at **up to 20 tool calls per month** -- for the month, not
the session. S7 is twenty frames plus a two-mode variable collection plus components.
That is hundreds of calls. **Twenty is not a slow version of that work.**

Recorded as a fact rather than a conclusion: the authenticated Figma identity is
`abenezerlibamu421@gmail.com`, which is not the account this repository's commits are
authored by. Whether that is the intended account is not something the build can
determine.

**To clear it, both are needed:** the file's owner shares `FneEVVjS5zjOA03NrVu4Rs`
with the authenticated Figma account **as an editor**, and that account holds a
**Full or Dev seat on a Professional plan or better** (200 calls/day). Figma's own
guidance is explicit that a Starter plan must be upgraded and that the new seat must
be Full or Dev.

**It is an access grant and a seat upgrade, not a decision.** Nothing in this
repository can clear it and no ruling is needed.

**S6.3 landed first, as ordered**, so the settled `packages/tokens` S7 depends on is
in place and waiting. The tokens now carry both modes under identical role names,
which is precisely the shape S7.3's Light/Dark variable collection needs -- a mode is
a second *value* for a name, never a second name.

---

## Parked, with reasons

- **D-255** - `fn_activate_due_payout` on the read path. **A ruling is requested:**
  keep the lazy activation on its own connection, or remove it and let the job own
  activation entirely?
- **D-260** - `packages/tokens` is still two files and dark mode doubled the surface.
  Nothing compares `index.ts` to `tokens.css`. This repository has a name for that
  shape and a gate for it in two other places. The comparator is small and was not
  built because the window's remaining work was S7. **It is the obvious next gate.**
- **D-261** - a `c4-financial` arm fails under parallel load and passes alone.
  **Not diagnosed, and this says so.** Ruled out: clock skew (measured at +0.1s with
  Postgres *ahead*, the wrong direction to cause it) and cross-suite teardown
  (distinct market and account ids). Two green runs is not a diagnosis.
- **D-241's remaining ruling** - `fn_cancel_payout_change` accepts a row whose
  `activates_at` has already passed. The job narrows the exposure from unbounded to
  five minutes; it does not remove the case.

## Not touched, deliberately (S8)

The three founder-owned engines (chatbot, trust, discovery). Rebuilding any console
screen to match a design. Amharic quality. The other twenty-five screens. Passkeys,
social OAuth, the operator surface, mobile, `ops/render.yaml`, and every remaining gap
sentence except the media one.
