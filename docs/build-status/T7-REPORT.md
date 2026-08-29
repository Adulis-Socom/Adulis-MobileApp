# WORK ORDER T7 REPORT

```
WORK ORDER T7 REPORT
Phase 1  D-57 BUILT  D-64 BUILT  D-66 BUILT  D-67 BUILT   backfill NULLs remaining: 0 (at migrate time -- see the deploy-window note)
Phase 2  APPENDIX A and APPENDIX B -- inline (S2 below)
         fixture vs database disagreements: NONE (66 types / 233 values identical
         both ways; 114 tables = doc 109 + the 5 BODY_OVER_MANIFEST rows exactly)
         what you believe the fixture has wrong: 2 items (S2 notes)
Phase 3  columns made nullable: 10   comparator: PASS   no-promotion-under-NULL: PASS
         S1.1 vs schema disagreements: prose counts only -- schema won, D-90;
         plus v1.1 S2's legal_config.media_retention (D-91) and row 15's NULL
         semantics conflict (D-92)
Phase 4  CODEOWNERS DONE   console CLAUDE.md DONE   staleness registered D-94
Phase 5  reached: C-2
         tokens populated and marked provisional: y
         C-1 at 1280 and 360: CSS reviewed, NOT observed (no browser in this run)
         twelve states demonstrable: y (StateDemo, behind a session)
         console automated tests: NONE -- see the Phase 5 note
         MT-KEYS.md: 149 keys
Gates    db:check 16/0/0   tests 430/430   determinism y   ci:local PASS (19 gates)
Register 21 new (D-84..D-104) -- BLOCKERs first, by id and title (S-Register below)
Parked   (S-Parked below, each with the ruling it needs)
State of main: clean
```

**The review model, as exercised.** Per T7 S0, every phase PR ran CI's gates plus an
adversarial pass (independent reviewer agents + refutation passes) before self-merge;
the passes are the review of record and their confirmed findings are applied in named
commits. Phase 1's pass caught a real concurrency defect (the invite CTE racing with
itself) and seven more -- eight findings survived refutation (7b7d73b); CI caught a T6 harness defect on Phase 3's first push (D-93);
Phase 3's pass found a teardown-residue class across ten suites and a hole in the new
gate's own enforcement bit (both applied pre-merge, commit dbc004a); Phases 4 and 5
record their passes in their sections.
Merges: PR #21 (Phase 1), #22 (Phase 3), #23 (Phase 4), #24 (Phase 5), each after its
own green CI.

---

## Phase 1 -- the four rulings (PR #21)

Built from T7 S3's binding text; ADU-RUL-02's document was never supplied (D-84), so
every citation reads "ADU-RUL-02 via T7 S3.x".

- **D-66** (0035): the anchor moved to `chat.message`; conversation columns, CHECK,
  write-once trigger and function dropped IN THE RIGHT ORDER (plpgsql is late-bound --
  wrong order kills every message send at runtime, not migrate time). Send-path
  validation per message, 404 on mismatch, the order arm keyed to the CONVERSATION's
  buyer. Slot resolution receives the answered message's own anchor; the filler is
  parked (D-85 -- no slot vocabulary exists in any document). The T7 gate holds:
  t7-rulings.spec.ts proves a second product in one thread resolves to its own anchor.
- **D-57** (0036): person created at declaration, one person per OWNER (S4.4's "once
  per person, referenced by each seller account" + S6.1's one-phone-one-account);
  the backfill moved 118 owners to 118 persons on the dev database at T7 -- an
observed run, recorded nowhere else, since the migration asserts only that no
INDIVIDUAL seller is left with a NULL person_id, and that assert is what CI
enforces; one-time DO-block assert (a forward CHECK would break 24 fixture files -- reasoning
in the migration). **The window 0036 names and this report owes you:** in a rolling
deploy, a pre-T7 pod serving a declaration AFTER 0036 commits writes a NULL-
person_id INDIVIDUAL seller that the already-passed assert cannot see. Both backfill
UPDATEs are deliberately re-runnable for exactly that reason, and re-running them
belongs in the deploy runbook. "0 NULLs" is true of migrate time, not of all time.
- **D-67** (0037): partial unique `seller_courier_invite_live` + two account FKs;
  orphan cleanup first (c6's replica-mode teardown had left exactly the predicted row);
  the invite endpoint stays one statement across all phone histories so G1.8's oracle
  survives; both re-invite arms tested.
- **D-64 residual** (0038): sessions were ALREADY revoked since 0023 -- the real delta
  was account_device: DELETE (not stamp), the session FK unhook, the missing DELETE
  grant that would have 42501'd at the first real deletion, and (adversarial pass) the
  backfill for accounts scrubbed between 0023 and 0038. Extracted with
  pg_get_functiondef per D-62, patched at one site.

**The adversarial pass caught, confirmed, and I applied:** the invite CTE self-race
(two live CLAIMED invites via the arbiter losing the winner's row -- advisory
xact-lock per (seller, phone)); the person-mint race (FOR UPDATE on the account row);
D-57's reuse key crossing ownership transfer (exclusion + D-88); authorization-before-
resource-validation ordering in postMessage; a buyer-side visibility oracle on the
product anchor; 0038's missing history backfill; a migration header claiming a fix the
PR did not contain (c6 teardown -- now real); two aspirational statements about the
then-unbuilt S1.1 gate.

## Phase 2 -- the appendices, generated (a deliverable, not a PR)

See `S2-APPENDICES` below -- Appendix A generated from `db/checks/fixtures/
appendix-a.json` `.types` (never the document's own stale table -- one of those two rows is D-58's, the other
A1.2's),
Appendix B from the live catalog in creation order with derived counts and the five
BODY_OVER_MANIFEST rows folded in and flagged by register id.

**Fixture vs live database: zero disagreements.** 66 types, 233 values, identical both
directions; 114 tables = check 14's manifest constant of 109 plus exactly the five pinned rows.
That constant comes from ADU-DB-01 v1.8's Appendix B; v1.12 PRINTS 112 over an
enumeration that sums to 109 (D-59's territory), so "the document's 109" would have
been the wrong way to say it.

**What I believe the fixture has wrong (asked for doubt, not a clean answer):**
1. `appendix-a.json`'s `_provenance` narrative says "230 values" and later "232"; the
   file holds 233 (D-58's OPERATOR_ATTESTED was added without updating the prose) --
   the fixture's own counting drift, harmless to check 16, which reads only `.types`.
2. The fixture cannot carry Appendix A's two prose annotations (`review_badge`'s
   "in descending weight", the `chat.resolution_path` cascade footnote); I reattached them from a hand-kept map with a
   one-off script that is NOT committed, so unlike MT-KEYS.md these two appendices
   cannot be regenerated from the tree. Their INPUTS are gate-checked
   (db/checks/fixtures/appendix-a.json and the live catalog); the assembly is not.
   The map is a fourth copy of a fact and will rot the same way -- v1.13 should decide where annotations live.
Also noted: D-59's register text claims the v1.12 core list held 85 names under a
heading of 84; the file as installed measures exactly 84 -- either D-59 miscounted or
described a different revision (unresolvable from the repo; flagged, not "fixed").

## Phase 3 -- ADU-RUL-02 (PR #22)

Ten NOT NULLs dropped -- enumerated from information_schema because three documents
carried three different wrong counts (D-90). No consumer changed: every fail-closed
guard already existed, guarding NULLs the schema forbade -- decorative for four work
orders, live now, and t7-deferred-nullability.spec.ts asserts the sentence D-61 said
could not be written (a seeded config, every OPEN column NULL, nobody past
ESTABLISHED, demotion only by upheld claim, source MODERATION). The S0.3 gate is real:
S1.1's table is parsed out of the governed register, held against the fixture both
ways and the live schema's nullability -- gate 16 of the one list. D-92 is parked -- its NULL means two opposite things. D-91
is NOT parked: it needs no ruling, only a correction in the v1.2 reissue.

**The phase-3 adversarial pass** (independent reviewer + refutation verifier; every
finding applied in dbc004a before merge): the teardown-residue CLASS -- ten suites
deleted sellers under replica mode without the auto-minted seller_public_stats row
(trg_create_public_stats), one dangling-FK row per run, six suites unbounded; all ten
now delete it first, and the 474 orphans already on the dev database were swept by
hand and re-verified at zero after a suite run. The comparator's own enforcement bit
(nullable_required) was unverified -- the verifier flipped it in the fixture and the
gate stayed green while the column's assertion silently degraded to a NOTE; it is now
derived from the register's binding sentences and reds on disagreement. One test TITLE and three COMMENTS claimed evidence never staged (counting handoffs,
cancellations); retitled and reworded to say exactly what is asserted -- the commit
message itself says "two test titles", and it is wrong. Residue left deliberately and counted: 204 dangling
core.claim_evidence_item rows on dev, the same class from suites this order does not
touch -- recorded so the next hygiene pass starts from a fact, not a surprise.

## Phase 4 -- the ownership records (PR #23)

CODEOWNERS: every path to @NaodSolomon -- and the API check that T7 S6's warning
invited found the deeper fact (D-94): neither `@naod` nor `@abenezer` was EVER a
collaborator; both handles belong to unrelated GitHub accounts; the file has requested
review from nobody since the day it was written. apps/console/CLAUDE.md: ownership
note, corrected governing versions, the stale "only C-1 is unblocked" block replaced.

**Note for the CEO, as ordered:** when branch protection becomes enforceable, required
approvals must be **0**, not 1 -- nobody can approve their own PR, and 1 would deadlock
every merge.

**The phase-4 adversarial pass** confirmed nine findings and refuted one, and the
worst was the one this phase existed to prevent: the ownership change was recorded
everywhere EXCEPT the root CLAUDE.md, the file every session loads, which still gave
apps/console to the COO/CTO and still required "both owners" to review packages/ and
any cross-boundary move. The CODEOWNERS rewrite had also silently falsified two
files nobody thought to check -- the storefront runbook's step 3 ("until then it has
no CODEOWNERS line, which is deliberate") and apps/mobile/CLAUDE.md's start-up
checklist -- and DOCUMENT_AUTHORITY still routed build/operations sequencing to ADU-
CON-02 v3.0, superseded and sitting in docs/superseded/. Two invented facts in my
own records came out: "cited from 30 files" was 29 at that commit, and
"MISSING_SOURCE on record since T6" pointed at a record that does not exist -- the
absence is real, the provenance was not. All fixed in a31362e. Underneath the
phase's own build recipe was a real defect, now **D-99**: apps/api loads no .env at
all, so `pnpm dev:api` from a clean shell runs with an empty DATABASE_URL and an
empty CONSOLE_ORIGIN -- and an empty CORS origin becomes a wildcard the browser
refuses on a credentialed request, then 403s every cookie-carried write. Nothing
raises; the process prints "api listening" and is wrong. It is why Phase 5's sign-in
only ever worked with the environment sourced by hand. **D-100** records that ADU-
API-01 catalogues 124 endpoints while the built contract carries 110 path keys and
129 operations, and that two further documents restate 124 as the count of what is
BUILT -- three quantities counted as one.

## Phase 5 -- the console, C-1 and C-2 (PR #24)

Reached: C-2 complete, against the REAL API (docker compose, seeded data), as S7.1
orders -- the mock is not in the loop. This closes the "~25% of the workstream at
~2%" gap the order named, to the depth C-1/C-2 define.

**C-1.** `@adulis/tokens`: wireframe conventions only, marked a placeholder awaiting
design in the package itself -- greyscale plus one accent, system font stack
including Noto Sans Ethiopic, 44x44 minimum targets (--adu-touch-min), spacing and
radius scales. No brand invented. states.ts: the twelve-state screen vocabulary as a
closed type. Precisely: the vocabulary has ONE renderer (ScreenState) and StateDemo
exercises all twelve of its branches -- the sign-in, chooser and placeholder screens
render their own markup and do not route through it yet. The demo is the index route
of /s/:sellerId, behind RequireSession, so seeing the twelve states takes a signed-
in session and a pasted store id. There is no /dev route. Shell/nav/router: the seller id lives in the URL
(/s/:sellerId/...); the store chooser takes a pasted id because no endpoint lists
stores (D-97 -- the hole is labeled ON the screen, not hidden). intl.ts holds the
formatting seam: absolute market time, currency from minor units, and whole-sentence
templates with named slots (never concatenated fragments).
Locale: en.ts authored; am.ts machine-translated placeholders with MT-KEYS.md naming
all 149 keys owed to a translator; a missing Amharic key is a compile error, and the parity is real (149 keys in each
catalogue, symmetric difference empty). One correction the review earned:
**AM_ENABLED does not exist.** It appears in specs, comments and MT-KEYS.md, but
there is no flag, no language switcher, and no console module imports `am` -- every
screen imports `en` directly. "Amharic stays off" is therefore true only because the
mechanism was never built, which is a different sentence from the one the order's
checklist invites, and worth saying plainly. A second caveat on the same seam:
nothing in CI regenerates or verifies MT-KEYS.md, so it can drift from en.ts
silently; it simply has not yet. Layout is fluid -- no fixed heights on translated text, one
grid that widens at 1024px; verified by build and CSS review at 1280/360. No browser
automation was in this run's loop, so nothing ever rendered the page: the breakpoint
and the absence of fixed heights were read in the CSS, not observed. StateDemo is
the demonstration of the twelve states.

**C-2.** SC-00 sign-in (phone -> OTP -> verify), remember-device, and the idle
warning -- plus SC-31 step-up BUILT BUT NOT REACHABLE: nothing imports StepUpModal,
because what summons it is a 403 STEP_UP_REQUIRED from a protected action, and no
protected action exists before C-3. It is code waiting for its caller, and listing
it as delivered would be the overclaim this report exists to avoid. The done-clause was exercised literally against the running API: OTP
read off the API terminal (S13's [FAKE SMS] print, made real in sms.adapter this
phase), verify with audience CONSOLE + remember_device, BOTH __Host- cookies set and
no token in any response body, GET /v1/auth/sessions answering current:true remembered:true, and -- after the
review's repairs -- DELETE /v1/auth/sessions/{id} revoking the session with the next
call answering 401, which is the signed-out path the console now maps. One honest
qualification: the seller-scoped readiness read (nine items) was driven directly
against the API, not by the console. The client supports X-Adulis-Seller, but every
call the console makes today is under /auth, so nothing in C-1/C-2 exercises that
header. The idle warning fires 5 minutes before the limit -- on shipped defaults,
because no endpoint transmits the real values (D-96); the server stays authoritative
and the 401 is handled.

**The ten rules -- honestly, which ones C-1/C-2 could exercise.** Six have surfaces
in this scope and are enforced: no business state client-side (signed-in state is
INFERRED from responses via the boot probe, nothing cached across navigation); the
seller id in the URL; no localStorage, sessionStorage, or token in JS anywhere
(grep-clean) -- which left the device identity with no honest home and produced D-95;
idempotency keys minted on MOUNT, not on click, so a double-tap is one key
(lib/idempotency.ts); a missing Amharic key is a compile error; and no fixed heights
on translated text.

Four could not be exercised, and I am not claiming them: **rule 5** (equally-weighted
payment decisions) and **rule 9** (evidence blob URL revoked) have NO surface in
C-1/C-2 -- there is no payment or evidence screen yet, and building one to satisfy a
rule would be the invention the order forbids. **Rule 4** (handoff controls disabled,
not hidden) has no handoff surface either; what exists is its general mechanism --
ScreenState's NO_ENTITLEMENT renders visible-and-disabled with what unlocks it, and
S3.4's "nothing at all" case is deliberately distinct. **Rule 3** asks for three clock
treatments; C-1/C-2 display exactly two -- absolute market time (the idle warning,
through intl.ts) and a seconds countdown (resend, rate-limit, through a locale
template) -- so the third has no surface to land on. All four are owed at C-3+ with
the screens that need them; none is built speculatively.

a11y is in from C-1, not deferred: labels on every input, role="alert" on the idle
warning, aria-busy on submitting controls, and a 44px minimum target in the CSS, not
only in the token file.

**Stack, recorded as staging (apps/console/CLAUDE.md), not deviation:** react-router
lands now (7.18.3, pinned); TanStack Query, Tailwind 4, RHF+Zod remain the
destination (C-3+); hand CSS on the tokens' custom properties until design exists.
Contract gaps hit and registered rather than papered over: D-95, D-96, D-97, D-98.
**Two tensions the console code says are recorded here, so here they are.** (1)
**429 has no state.** The twelve-state vocabulary is closed and holds no
RATE_LIMITED, so a 429 renders through CONFLICT with the retry seconds in the
message. That is a real seam: the closed set is a virtue (no screen invents a
thirteenth state) and this is the first place it pinches. Widening it is ADU-CON-03
territory, not mine. (2) **The market timezone is a literal.** Shell renders the
idle warning with timezone="Africa/Addis_Ababa" while intl.ts states that formatting
runs against the market timezone from /v1/bootstrap. Correct for the only market
that exists and wrong the day a second one does; it is a hardcode, not a resolution,
and it is named as one here rather than left to be discovered. **What C-1 renders
that does nothing yet:** the shell's notification bell and account menu are
placeholders, and the seller switcher cannot render at all until D-97 gives it a
list. They are visible structure, not working controls. **No automated test
exercises any of this.** apps/console has no test harness -- the 430 tests in the
header are the API's, and not one of them touches the ~2,000 lines Phase 5 added.
What stands behind C-1/C-2 instead: typecheck, lint, the production-build gates (17
and 18), and the live sign-in flow driven end to end against the real API. That is
verification, but it is not coverage, and a regression in this code would be caught
by a person, not by CI. A harness is owed at C-3.
seed.mjs provisions the whole dev loop, fixed uuids, idempotent.

**The phase-5 adversarial pass** ran four lenses (rule conformance, security, the
record, product correctness), each verified by a separate skeptic. It was the most
productive hour of the order and it found, among much else, that **the console I had
just built did not run**. **The bundle threw before React mounted.**
`resolveApiBaseUrl` was called at module scope, so a build without VITE_API_BASE_URL
threw during import -- before createRoot, where no error boundary can exist. The
page was blank. Every gate stayed green over it, because gates 17 and 18 inspect the
build OUTPUT for unsafe-eval and production React and neither has an opinion about
whether the artifact boots. The resolution is lazy now: a misconfiguration surfaces
on first request, as a state the twelve-state vocabulary can render. **Four more
that would have reached a seller.** "Change number" reused the mounted idempotency
key, so the second number returned 409 IDEMPOTENCY_KEY_REUSED on a control the
screen invites you to press -- and re-typing the SAME number was worse: the server
replayed its stored 202 and dispatched no SMS while the screen advanced to the code
step and started a countdown for a code nobody sent. There was **no way to sign
out**: the account control had no handler, `common.signOut` had no render site, and
a 401 left a fully rendered shell in place. The idle clock ran from pointer and key
events while the server's runs from the last REQUEST, so an active seller was never
warned and the session expired silently underneath an interactive console; "Stay
signed in" then reported success on requests the server never saw, because keepAlive
swallowed everything but a 401. And the state mapper had two identical arms, sending
401, 403 and 404 alike to TRANSPORT_ERROR with a Retry button for things retrying
cannot fix. All repaired, and the sign-out and 401 paths verified against the
running API. **The security finding I take most seriously is mine.** The [FAKE SMS]
print I added to make S13's promise true wrote a phone number and a live OTP through
console.warn, which bypasses the logger's NEVER_LOG redaction entirely -- and its
guard was `!== 'test'`, i.e. print everywhere except jest. Nothing in this
repository sets NODE_ENV=production (no render.yaml, and the deploy runbook never
mentions it -- D-80), so the one deployment that must never see it was the one it
printed in. The gate is an allow-list now: development only. **And it predicted a
defect the dev loop then reproduced.** The seed wrote a second live market; identity
creation resolves "the market" with an unordered `LIMIT 1`; so the c6 suite's new-
account tests began landing accounts in the seed's market, invisible to c6's own
teardown, and the next run failed with a 200 where a 400 belongs. Green suite,
seeded database, silent failure. The seed's market is non-live now and corrects
itself on re-run; the unordered lookup is **D-104**, unchanged, because making it
deterministic decides which market every future account joins. **Three things I did
not fix, on purpose.** A person with no account still cannot sign in: verify demands
`age_declared_over_18` and no control collects it (**D-101**). The control is three
lines; its LABEL is a legal attestation whose English and Amharic wording is not
mine to invent, and the console fails closed rather than silently creating an
account. The console's device identity is a build-time constant shared by every
browser loading the bundle, which makes the new-device payout lock inert (**D-102**)
-- and every available fix invents an authorization rule. The console never calls
/v1/bootstrap, so the market timezone and currency are literals and UPGRADE_REQUIRED
is unreachable (**D-103**) -- owed build, not a decision.

---

## S2-APPENDICES

## Appendix A -- Enum catalogue

> Generated from `db/checks/fixtures/appendix-a.json` (the form check 16
> executes), never from the document's own printed table -- two of its rows
> were stale (D-58, A1.2). There is no asserted count, per v1.9's D6 fix;
> the check is the count.

**`core`**

| Type | Values |
|---|---|
| `market_phase` | `PHASE_1`, `PHASE_2` |
| `platform` | `TIKTOK`, `INSTAGRAM` |
| `account_status` | `ACTIVE`, `SUSPENDED`, `SCRUBBED` |
| `device_platform` | `ANDROID`, `IOS` |
| `notification_permission` | `GRANTED`, `DENIED`, `NOT_ASKED` |
| `otp_purpose` | `SIGN_IN`, `STEP_UP`, `ACCOUNT_DELETION`, `RECOVERY` |
| `session_audience` | `MOBILE`, `CONSOLE` |
| `fulfilment_method` | `BUYER_COLLECTION`, `SELLER_DELIVERY`, `COURIER_DELIVERY` |
| `operator_role` | `SUPPORT`, `MODERATOR`, `CLAIM_REVIEWER`, `IDENTITY_REVIEWER`, `ADMIN` |
| `step_up_action` | `PAYOUT_CHANGE`, `REISSUE_INSTRUCTIONS`, `TEAM_CHANGE`, `SUBSCRIPTION_CHANGE`, `SELLER_DELETION`, `REVOKE_ALL_SESSIONS`, `IDENTITY_CHANGE`, `OWNERSHIP_TRANSFER` |
| `recovery_decision` | `APPROVED`, `REJECTED` |
| `team_role` | `OWNER`, `ADMIN`, `SALES_SUPPORT`, `INVENTORY`, `ANALYST`, `CAMPAIGN_MANAGER` |
| `seller_entity_type` | `INDIVIDUAL`, `COMPANY` |
| `seller_status` | `DRAFT`, `ACTIVE`, `CLOSING`, `BILLING_SUSPENDED`, `SAFETY_SUSPENDED`, `DELETED` |
| `social_verification_status` | `PENDING`, `VERIFIED`, `REVOKED` |
| `follower_count_source` | `PLATFORM_FETCH`, `MANUAL_FALLBACK` |
| `eligibility_path` | `AUDIENCE`, `IDENTITY` |
| `eligibility_outcome` | `SATISFIED`, `NOT_SATISFIED` |
| `id_verification_requirement` | `OPTIONAL`, `MANDATORY_WITHOUT_AUDIENCE`, `MANDATORY_ALL` |
| `threshold_basis` | `HIGHEST_SINGLE` |
| `trust_level` | `NEW`, `ESTABLISHED`, `TRUSTED` |
| `level_change_source` | `COMPUTED`, `MODERATION` |
| `attribute_data_type` | `TEXT`, `NUMBER`, `ENUM`, `BOOLEAN` |
| `idempotency_actor_kind` | `ACCOUNT`, `DEVICE` |
| `rate_limit_subject_kind` | `ACCOUNT`, `DEVICE`, `PHONE_HASH`, `IP_HASH` |
| `product_visibility` | `DRAFT`, `PUBLISHED`, `UNPUBLISHED` |
| `unpublished_reason` | `SELLER`, `TIER_DOWNGRADE`, `LEVEL_DOWNGRADE`, `MODERATION` |
| `media_class` | `HOT`, `INFREQUENT` |
| `social_post_status` | `LIVE`, `UNAVAILABLE`, `UNKNOWN` |
| `stock_event_reason` | `SELLER_SET`, `ORDER_CREATED`, `ORDER_EXPIRED`, `LINE_CANCELLED`, `RECONCILIATION`, `RESTOCK` |
| `cart_status` | `ACTIVE`, `CONVERTED`, `ABANDONED` |
| `order_state` | `CREATED`, `NOTIFIED`, `PAYMENT_SUBMITTED`, `PAYMENT_CONFIRMED`, `HANDED_OFF`, `COMPLETED`, `CANCELLED_BY_BUYER`, `CANCELLED_BY_SELLER`, `EXPIRED_UNCLAIMED` |
| `reservation_state` | `ACTIVE`, `FULFILLED`, `CANCELLED_BY_BUYER`, `CANCELLED_BY_SELLER`, `REFUNDED`, `EXPIRED` |
| `cancelled_by` | `BUYER`, `SELLER`, `SYSTEM` |
| `payment_submission_state` | `SUBMITTED`, `CONFIRMED`, `REJECTED` |
| `payout_state` | `PENDING`, `ACTIVE`, `CANCELLED`, `SUPERSEDED` |
| `scan_validity` | `VALID`, `LATE`, `REJECTED_REPLAY`, `REJECTED_HORIZON` |
| `confirmation_tier` | `VERIFIED_HANDOFF`, `CONFIRMED_BY_BUYER`, `UNCONFIRMED` |
| `review_badge` | `CLAIM_UPHELD`, `VERIFIED_HANDOFF`, `CONFIRMED_BY_BUYER`, `UNVERIFIED` -- in descending weight |
| `claim_opener_kind` | `BUYER`, `SYSTEM`, `MODERATION` |
| `claim_trigger` | `SLA_BREACH`, `STOCK_NOT_UPDATED`, `GOODS_NOT_RECEIVED`, `NOT_AS_DESCRIBED`, `REFUND_NOT_DELIVERED` |
| `claim_outcome` | `UPHELD`, `NOT_UPHELD` |
| `claim_evidence_kind` | `CHAT_HISTORY`, `SCAN_RECORD`, `PAYMENT_EVIDENCE`, `BANK_RECORD`, `STOCK_EVENTS`, `ORDER_TRANSITIONS`, `SELLER_LEVEL_AT_ORDER`, `ACTING_TEAM_MEMBER` |
| `follow_state` | `FOLLOWING`, `UNFOLLOWED` |
| `seller_activity_kind` | `NEW_PRODUCT`, `RESTOCK`, `BROADCAST`, `STOREFRONT_UPDATE` |
| `broadcast_kind` | `RESTOCK`, `DISCOUNT` |
| `notification_channel` | `PUSH`, `SMS`, `IN_APP` |
| `actor_channel` | `WEB`, `MOBILE`, `SYSTEM` |
| `claim_state` | `AWAITING_BUYER_EVIDENCE`, `AWAITING_SELLER_EVIDENCE`, `AWAITING_BANK_TRACE`, `UNDER_REVIEW`, `RESOLVED` |
| `claim_severity` | `ORDINARY`, `PAYMENT_FRAUD` |
| `claim_remedy` | `REFUND`, `FULFIL`, `NONE` |
| `notification_state` | `QUEUED`, `SENT`, `DELIVERED`, `FAILED`, `SUPPRESSED` |
| `report_target_kind` | `PRODUCT`, `REVIEW`, `MESSAGE`, `SELLER`, `STOREFRONT` |
| `moderation_queue_kind` | `PROHIBITED_KEYWORD`, `NEW_SELLER`, `NEW_LEVEL_FIRST_LISTING`, `SENSITIVE_CATEGORY`, `POST_LINK_CONFLICT`, `DOUBLE_ALLOCATION`, `REPORT`, `VELOCITY` |
| `active_orders_decision` | `CONTINUE`, `TERMINATE` |

**Other schemas**

| Type | Values |
|---|---|
| `verification.verifier_kind` | `KYC_VENDOR`, `VIDEO_CALL`, `OPERATOR_ATTESTED` |
| `financial.retention_reason` | `AWAITING_VALIDATION`, `OPEN_CLAIM` |
| `financial.secret_subject_kind` | `PAYMENT_EVIDENCE`, `PAYOUT_CREDENTIAL` |
| `chat.message_sender_kind` | `BUYER`, `SELLER`, `TEAM_MEMBER`, `BOT` |
| `chat.resolution_path` | `STRUCTURE`, `CHIP`, `KEYWORD`, `EMBEDDING`, `CLASSIFIER`, `ESCALATED` |
| `nlu.phrase_source` | `SEED`, `HARVESTED` |
| `billing.subscription_state` | `BETA`, `TRIAL`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`, `CANCELLED` |
| `billing.subscription_tier` | `LISTED`, `ASSISTED`, `VERIFIED_PRO`, `BUSINESS` |
| `billing.subscription_term` | `MONTHLY`, `QUARTERLY`, `ANNUAL` |
| `ledger.entry_direction` | `DEBIT`, `CREDIT` |
| `waitlist.platform` | `TIKTOK`, `INSTAGRAM` |

`chat.resolution_path` mirrors the six S15.1 cascade layers exactly, so
containment is a GROUP BY rather than a derivation.

---

## Appendix B -- Table manifest

**114 tables**, and **every count below is derived from its own list** --
the manifest is reconciled FROM the schema (`pg_class`, nine schemas, partitions
excluded), never the reverse. The five rows the v1.12 manifest lacked are folded
in and flagged: they are check 14s BODY_OVER_MANIFEST set, each with its
register entry. AO = append-only (carries `trg_append_only` and the REVOKE).

**`core` -- 88**  -  `market`  -  `market_phase_gate`  -  `eligibility_config`  -  `ladder_config`  -  `timing_config`  -  `locale_pack`  -  `identity_config`  -  `legal_config`  -  `person`  -  `account`  -  `buyer_profile`  -  `device`  -  `otp_challenge`  -  `account_device`  -  `session`  -  `step_up_challenge`  -  `account_recovery_case`(AO)  -  `seller`  -  `seller_company_detail`  -  `seller_team_member`  -  `seller_courier`  -  `seller_social_account`  -  `account_control_challenge`  -  `seller_eligibility_evaluation`(AO)  -  `seller_availability`  -  `seller_availability_override`  -  `seller_fulfilment_method`  -  `operator_grant`(AO)  -  `permission`  -  `role_permission`  -  `category`  -  `category_market_availability` [D-18]  -  `attribute_definition`  -  `attribute_option`  -  `product`  -  `product_attribute_value`  -  `product_variant`  -  `variant_attribute_value`  -  `product_image`  -  `product_video`  -  `media_lifecycle`  -  `social_post`  -  `product_social_post`  -  `stock_event`(AO)  -  `seller_level_state`  -  `seller_level_event`(AO)  -  `level_velocity_flag`  -  `buyer_seller_pair_signal`  -  `seller_public_stats`  -  `cart`  -  `cart_line`  -  `order`  -  `reservation`  -  `order_state_transition_legal`  -  `reservation_state_transition_legal`  -  `order_state_transition`(AO)  -  `order_qr_token`  -  `refund`  -  `buyer_cancellation_counter`  -  `order_courier_assignment`  -  `payment_submission`  -  `payout_details`  -  `payout_change_log`(AO)  -  `order_payout_snapshot`  -  `payment_instruction_reissue`(AO)  -  `courier_custody_transfer`  -  `handoff_scan`(AO)  -  `order_confirmation`  -  `review`  -  `review_item_rating`  -  `claim`  -  `claim_evidence_item`(AO)  -  `evidence_export`  -  `follow`  -  `seller_activity`  -  `broadcast`  -  `notification`  -  `content_report`  -  `block`  -  `moderation_queue_item`  -  `moderation_event`(AO)  -  `prohibited_keyword`  -  `phone_reuse_block`  -  `idempotency_record`  -  `rate_limit_bucket`  -  `notification_preference` [D-40]  -  `seller_courier_invite` [D-59]  -  `seller_ownership_transfer` [D-70]

**`verification` -- 2**  -  `identity_attestation`  -  `access_log`(AO)

**`financial` -- 3**  -  `payment_evidence`  -  `payout_credential`  -  `access_log`(AO)

**`chat` -- 3**  -  `conversation`  -  `message`  -  `bot_turn`(AO)

**`nlu` -- 6**  -  `intent`  -  `intent_phrase`  -  `answer_template`  -  `unmatched_phrase`(AO)  -  `regression_case`(AO)  -  `regression_run`(AO)

**`billing` -- 7**  -  `subscription`  -  `subscription_state_transition`(AO)  -  `price_schedule`  -  `tier_definition`  -  `collection_record`  -  `inference_usage_month`  -  `purchase_intent` [D-68]

**`ledger` -- 2**  -  `transaction`(AO)  -  `entry`(AO)

**`analytics` -- 2**  -  `event_definition`(AO)  -  `event`(AO) (monthly partitions)

**`waitlist` -- 1**  -  `application`

**22 append-only tables.** Every one carries both the trigger and the
`REVOKE` (S4); Appendix C check 5 asserts the count and both mechanisms.


---

## S-Register -- 21 new entries (no BLOCKERs; MAJORs first)

```
MAJOR    D-88  ownership transfer moves the store and leaves the person; D-57's
               reuse key must not follow it (narrow arm fixed; wide question parked)
MAJOR    D-89  a pending courier invite has no claim path -- the sign-in leg two
               migration headers describe is built nowhere
MAJOR    D-94  both CODEOWNERS handles were never collaborators; the outermost
               review layer was decorative since the day it was written
MAJOR    D-95  core.device_platform has no value a web console can honestly
               register (parked; dev loop seeded, the lie confined and named)
MAJOR    D-99  the API process loads no .env, so the documented dev recipe cannot
               work from a clean shell -- empty DATABASE_URL, and an empty
               CONSOLE_ORIGIN that makes CORS a wildcard (fail-open shaped)
MAJOR    D-101 a person with no account cannot sign in: verify demands an age
               declaration the console has no control for, and whose wording is
               a legal attestation, not a string to invent
MAJOR    D-102 the console's device identity is a build-time constant shared by
               every browser, so the new-device payout lock never fires
MAJOR    D-104 identity creation picks "the live market" with an unordered
               LIMIT 1 and nothing keeps there being only one -- found because
               it broke a green suite on a seeded database
QUESTION D-86  nothing forbids rewriting a message's anchor; the ruling is silent
QUESTION D-92  follower_threshold's NULL means two opposite things in one governing
               register (code fails closed; seed ships audience_required=false)
MINOR    D-84  ADU-RUL-02 named as installable, text never supplied -- every
               citation reads "ADU-RUL-02 via T7 S3.x"
MINOR    D-85  the slot vocabulary is ruled by nothing -- the anchor's reader is a
               seam, not a filler
MINOR    D-87  three governing-document passages now print pre-T7 shapes
               (documents are never edited here; owed to reissues)
MINOR    D-90  three documents, three different wrong counts of the still-NOT-NULL
               deferred columns -- the schema won, the gate now holds all three forms
MINOR    D-91  v1.1 S2 places media_retention in legal_config; the schema and
               ADU-DB-01 say timing_config
MINOR    D-93  the console build-output gates failed every scoped CI run that
               skipped the console (fixed: pass-with-note under scope, hard otherwise)
MINOR    D-96  no endpoint transmits the idle-session values the console warns
               about (shipped defaults, named as such, marked for deletion)
MINOR    D-97  no endpoint lists the caller's own sellers -- the chooser's hole is
               labeled on the screen itself
MINOR    D-98  the auth operations are schema-less in the contract -- typed
               locally, marked for deletion, never reconciliation
MINOR    D-100 ADU-API-01 catalogues 124 endpoints; the built contract has 110 path
               keys and 129 operations, and two other documents restate 124 as the
               count of what is BUILT -- three quantities counted as one
MINOR    D-103 the console never calls /v1/bootstrap: the market timezone and
               currency are literals, and UPGRADE_REQUIRED is unreachable
```

## Errata -- register numbers cited wrongly in code

Four were found, three fixed in Phase 5's branch: `IdleWarning.tsx` cited D-93 (the
scoped-gate defect) where it means D-96 (the idle values); `Shell.tsx` cited D-95 (the
device platform) where it means D-97 (the sellers list); and `am.ts` -- a USER-FACING
Amharic string -- cited D-96 where its English twin correctly cites D-97. The third is NOT fixed and will not be: `0039_deferred_values_nullable.sql`'s
header cites D-88 where it means D-90, and that migration is merged. **Merged
migrations are never edited** (T7 S2), and a comment is not worth the one exception
that teaches the rule is negotiable. It is recorded here instead, which is where a
reader who follows the citation and lands on the wrong entry will find the answer.

## S-Parked -- what needs a ruling, by entry

- **D-84**: supply ADU-RUL-02's text, or bless the via-T7 citation form permanently.
- **D-85**: the slot vocabulary -- what a filled slot IS; until then the reader
  returns the seam value and invents nothing.
- **D-86**: may a message's anchor ever change? Today no code path updates it and no
  constraint forbids it.
- **D-88**: person vs ownership transfer -- does an INDIVIDUAL store's person follow
  the store, the human, or neither? (A btree_gist EXCLUDE could hold "one person per
  owner" database-side but would make fn_activate_due_ownership_transfer -- D-74's
  never-raise function -- raise on transferred-in INDIVIDUAL stores; blocked on this
  ruling.)
- **D-89**: the claim-at-sign-in mechanism -- which purposes, what notification to
  the seller, what expiry a pending invite carries (today: none).
- **D-92**: which reading governs row 15's NULL -- fail closed as built, or PRD
  S4.1's fail open (one line + one test if the latter).
- **D-95**: WEB in core.device_platform (plus whether CONSOLE verify may
  auto-register an unseen device), or console sessions never mint device rows.
- **D-96**: which surface carries the idle-timeout values (natural seam:
  GET /v1/auth/sessions gaining idle_timeout_seconds on the current row).
- **D-97**: the sellers-list endpoint shape (owned + team-membered, role per store)
  -- an ADU-API-01 amendment.
- **D-94**: two document reissues, owed and unscheduled -- ADU-REPO-01 (S3, S9, and
  the file's own installation, since it is cited across the repo and installed
  nowhere) and ADU-CON-02 (S14.1's review model; S21's branch-protection note, which
  should gain the required-approvals-must-be-0 sentence below).
- **D-99**: whether the API loads .env in its dev entry point or asserts required
  configuration at boot and refuses to start -- the second also closes a wildcard-CORS
  fail-open.
- **D-100**: an audit of ADU-API-01's 124-entry catalogue against the contract's 110
  path keys -- unbuilt scope, or three quantities counted as one.
- **D-101**: the exact English and Amharic wording of the age declaration, and where
  it sits on SC-00. One ruled sentence unblocks first-time sign-in.
- **D-102**: what identifies a browser for a payout lock, given that the console may
  persist nothing -- most likely the httpOnly device cookie the server already sets.
- **D-104**: whether more than one live market is legal. If not, a partial unique
  index makes the LIMIT 1 honest; if so, both lookups need a deterministic ORDER BY
  and a rule for which live market a new account joins.
- **Phase 2's annotation question, for v1.13**: where Appendix A's two prose
  annotations live, so the fourth copy of that fact can be retired.
