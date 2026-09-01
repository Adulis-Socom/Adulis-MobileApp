# Runbook — activating a market for OTP

**Status:** ready to run. **Frequency:** once per market, by hand.
**Owner:** CEO. **Source:** ADU-AUTH-01 v2.6 S9, S9.1, S9.2, S9.3, S9.4, S10, S16 ·
ADU-DB-01 v1.14 S30b.

---

## Why this is a runbook and not an endpoint

**v2.6 S9.4 says it in one line: "During founder-only MVP, market activation is a
privileged founder-run operation."** No console screen writes these columns, no API
endpoint exposes them, and `core.market` carries no operator surface at all.

**It joins the hand-run set, and naming that set is the point** — the concentration is
only visible if the members are counted. Every runbook here is one person acting alone on
something outside the repository:

| Runbook | What it decides |
|---|---|
| [`grant-founder-operator.md`](grant-founder-operator.md) | who may review identity, claims and moderation |
| [`billing-reconciliation.md`](billing-reconciliation.md) | that a bank transfer really arrived |
| [`deploy.md`](deploy.md) | that this build is the one production runs |
| [`storefront-import.md`](storefront-import.md) | *(blocked — needs the repository URL)* |
| **this one** | that a country may receive OTP at all |

> **An earlier draft of this page called this "the fourth" and counted identity
> attestation as one of the three before it. That was wrong twice over.** Identity
> attestation is performed THROUGH THE PRODUCT — `POST /v1/seller/identity-verification`
> calling `verification.write_attestation` — not by hand; and `deploy.md`, which really is
> hand-run, was left out to make the number come to four. **A count that has to choose its
> members is not a count.**

> **[!] `adulis_app` can write these columns.** It holds ordinary DML on `core.market`,
> inherited because S9.1's configuration was folded INTO that table rather than given its
> own (D-187), and no `REVOKE` narrows it. **A comment cannot revoke a grant** — this is
> registered as D-186 with three options and deliberately not patched, because a privilege
> change against the live application role belongs with D-185's withdrawal of `is_live`,
> which rewrites who reads and writes this table anyway. Until then, "only the founder
> does this" is a convention, not an enforcement.

---

## Before you start — S9.3's checklist, and it is not optional

**"Provider marketing coverage alone is insufficient"** (S9.3). Fourteen items, and the
ones that have actually blocked Adulis are marked:

1. number parsing tested for the country's formats;
2. provider coverage confirmed **for that country, by test message** — not from a
   coverage map;
3. sender requirements reviewed (alphanumeric permitted? pre-registration?);
4. A2P / OTP use allowed under local rules;
5. **sender registration completed where needed** — *blocked for Adulis: every provider
   requires a registered business*;
6. template requirements reviewed;
7. **provider account approved** — *same blocker*;
8. price per message recorded;
9. soft / hard OTP budgets configured (step 3 below);
10. test SMS succeeds end to end;
11. p50 / p95 delivery latency measured;
12. delivery status reporting verified (callbacks land, S13);
13. fallback policy documented — **or explicitly NONE**, which is Ethiopia's answer;
14. provider geographic controls configured to mirror this market (S16.3).

**Steps 5 and 7 are why no real vendor is bound.** Every provider named in v2.6 —
AfroMessage, SMSEthiopia, Infobip, Twilio — needs a registered business, which Adulis does
not yet have. The four providers in `apps/api/src/modules/auth/sms-provider.ts` are ONE
fake class instantiated under four names, and it refuses to construct under
`NODE_ENV=production`.

> **No vendor adapter exists yet — the interface is what was buildable.** Binding a real
> one means WRITING an adapter (`implements SmsProvider`, with its own mapping from that
> vendor's responses to `ACCEPTED` / `DEFINITIVE_NOT_SENT` / `DELIVERY_UNKNOWN`, which
> S5.6 requires every adapter to document) and then changing one line in `app.module.ts`.
> **Nothing above that line changes**, which is the property the layer was built for — but
> "one line" describes the wiring, not the work.

---

## The two prerequisites that are NOT on S9.3's list

**Read both before activating a SECOND market. Neither matters while Ethiopia is alone.**

### 1. Per-market OTP spend is not attributable yet

`core.otp_delivery_attempt` carries no market, and neither does `core.otp_challenge`.
v2.6 S12.1's field list has none and ADU-DB-01 v1.14 adds none, so the daily counter in
`OtpIssuancePolicy` counts **platform-wide** attempts.

While exactly one market is `ACTIVE` that is not an approximation — only `ACTIVE` markets
issue, so every attempt in existence belongs to the one that does. **With two, the count
over-counts each of them.** It can only ever over-count, so the breaker fires *early*,
never late — safe in the direction that matters, and unfair in the other: **a busy market
can spend a quiet market's allowance.**

> **Fix before market two: a `market_id` on `core.otp_challenge`, written at issue.** That
> is a DB amendment, not a code change. Registered.

### 2. Sender registration is only half-enforced

A `REJECTED` sender registration refuses AT ISSUE — in `OtpIssuancePolicy`, before a
code is generated — and the router refuses it again before transporting. The second alone
was not enough and is worth saying why: it runs after the challenge has committed, so it
produced a live, verifiable, undeliverable code and a 500 instead of a refusal. S10.2's
rule is "status != APPROVED forces `otp_enabled` = false", which is a refusal to ISSUE.

**The rest of S10.2 cannot be enforced**: `PENDING` and `NOT_REQUIRED` are not refused,
because **the schema does not carry WHERE registration is mandatory** — migration 0043's
own comment admits it in its last clause.

So item 3 and item 5 of the checklist above are that enforcement. A human decides whether
this market's sender registration was mandatory, and the answer lives nowhere but here.

---

## The activation

Everything below is `psql` against production as the migration role. **Nothing in the
application performs these writes**, and there is no screen.

### Step 0 — read the current state

```sql
SELECT code, display_name, activation_state, otp_enabled,
       sms_primary_provider, sms_fallback_provider,
       sender_mode, sender_id, sender_registration_status,
       sms_compliance_status, otp_daily_soft_limit, otp_daily_hard_limit
  FROM core.market ORDER BY code;
```

**A market not listed here does not exist and cannot be activated.** Creating one is a
separate act (`core.market` plus `core.timing_config`, `core.ladder_config`,
`core.eligibility_config`, `core.legal_config`, `core.identity_config`).

> **A market with no live `core.timing_config` answers `INTERNAL` — a 500, not a refusal.**
> The OTP path reads timing BEFORE it reaches the activation gate, and a market configured
> to serve but carrying no timing is our defect rather than the caller's mistake. It is not
> the `VALIDATION_FAILED` the rest of this page describes.
>
> `timing_config` carries `EXCLUDE USING gist (market_id WITH =, effective WITH &&)`, so
> **rotating one leaves a gap unless the new row's `effective` range abuts the old.**

### Step 1 — walk the state machine, do not jump to ACTIVE

S9.2's seven states exist so the checklist has somewhere to be recorded. Use them:

```sql
UPDATE core.market SET activation_state = 'COMPLIANCE_REVIEW' WHERE code = 'XX';
-- ... items 3, 4, 6 done ...
UPDATE core.market SET activation_state = 'SENDER_PENDING',
       sender_mode = 'ALPHANUMERIC_SENDER', sender_id = 'Adulis',
       sender_registration_status = 'PENDING' WHERE code = 'XX';
-- ... item 5 returns ...
UPDATE core.market SET sender_registration_status = 'APPROVED' WHERE code = 'XX';
-- ... items 10, 11, 12 measured against the real vendor ...
UPDATE core.market SET activation_state = 'TESTING' WHERE code = 'XX';
```

> **Do not set `sender_registration_status = 'APPROVED'` until a vendor has actually
> approved the sender ID.** The development seed used to say `APPROVED` and it was
> corrected for this reason: a seed is the row an operator copies, so a seed that claims
> an approval is how a production row comes to claim one too.

### Step 2 — the route (S6.1, S7.1)

```sql
UPDATE core.market
   SET sms_primary_provider  = 'INFOBIP',   -- ETHIOPIA: 'AFROMESSAGE'
       sms_fallback_provider = 'TWILIO'     -- ETHIOPIA: NULL, see below
 WHERE code = 'XX';
```

**Ethiopia's fallback is `NULL` and that is the configured answer, not a missing one.**
S7.1 makes SMSEthiopia a *candidate*, not a route, until S7.2's acceptance requirements
pass. So S7.4's accepted limitation holds and should be understood before an outage
rather than during one:

```
AfroMessage down
    |
    +-- new OTP sends FAIL
    |
    +-- codes already delivered STILL VERIFY   (verification is local)
```

A `NULL` fallback is enforced as one attempt and no second: the router returns
`fallback: null` and the delivery service stops. **A fallback equal to the primary is
also treated as none** — two attempts against one vendor is not redundancy.

### Step 3 — budgets (S16)

```sql
UPDATE core.market SET otp_daily_soft_limit = 500, otp_daily_hard_limit = 1000
 WHERE code = 'XX';

SELECT * FROM core.platform_otp_budget;   -- one row, global, S16
```

**Soft alerts and keeps serving; hard blocks NEW ANONYMOUS issuance only.** It does not
invalidate a live code, does not log anyone out, and does not stop verification — a spend
control that ends a payout change mid-flight is a denial of service wearing a safeguard.
Authenticated step-up is served past the hard limit deliberately (S16.2).

`CHECK (otp_daily_soft_limit IS NULL OR otp_daily_hard_limit IS NULL OR
otp_daily_soft_limit <= otp_daily_hard_limit)` — soft above hard would make the alert
unreachable, so the database refuses it. **Either may be NULL**, meaning "no per-market
ceiling"; the global row still applies, and both of ITS columns are `NOT NULL`.

### Step 4 — activate

```sql
UPDATE core.market
   SET activation_state = 'ACTIVE', otp_enabled = true,
       registration_enabled = true,
       buyer_registration_enabled = true,
       seller_registration_enabled = true
 WHERE code = 'XX';
```

`CHECK (NOT otp_enabled OR activation_state = 'ACTIVE')` and
`CHECK (NOT otp_enabled OR sms_primary_provider IS NOT NULL)` — the database will not let
OTP be enabled on a market that is not ACTIVE, nor on one with nowhere to send.

**The implication runs ONE WAY.** `otp_enabled = true` forces ACTIVE and forces a route;
ACTIVE alone forces nothing, so `ACTIVE` with `otp_enabled = false` is a perfectly legal
row and is still a refusal. Set both.

### Step 5 — verify from the outside

```sql
SELECT m.code, count(a.*) AS attempts_today,
       count(*) FILTER (WHERE a.status = 'ACCEPTED') AS accepted
  FROM core.market m
  LEFT JOIN core.otp_delivery_attempt a
    ON a.created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
 WHERE m.code = 'XX' GROUP BY m.code;
```

Then request an OTP on a real handset in that country. **Item 10 of the checklist is not
"a test SMS was accepted by the API" — it is "a message arrived on a phone."**

---

## Suspending a market

```sql
UPDATE core.market SET activation_state = 'SUSPENDED', otp_enabled = false
 WHERE code = 'XX';
```

**`SUSPENDED` means no new entry and existing trade continues** (ADU-DB-01 v1.14 S30b.3,
D-183's ruling). No new OTP is issued into it, no new device is assigned to it, and every
account already there is untouched. That is a genuinely useful state, and it is the reason
`is_live` was withdrawn: a boolean could not express it.

**`BLOCKED` is the harder one** — regulatory or provider-side prohibition, and the state
machine keeps them distinct so a temporary spend freeze is never mistaken for a legal one.

---

## What to do when it goes wrong

| Symptom | Where to look |
|---|---|
| `VALIDATION_FAILED` with `path: bootstrap` on `/v1/auth/otp/request` | The device's market is not ACTIVE, or has `otp_enabled = false`, or has no `timing_config`. **The same refusal covers all three deliberately** — S17 forbids an answer that varies with whether the phone is known |
| `RATE_LIMITED` for every anonymous caller, none for step-up | The daily hard limit is reached. Working as specified (S16.2) |
| `INTERNAL` on every send in one market | No `sms_primary_provider`, a provider with no bound adapter, or `sender_registration_status = 'REJECTED'` |
| Attempts recorded `PENDING` and never resolved | The adapter neither returned nor threw. A row written before the vendor call is the point — the attempt is visible rather than absent |
| Two messages, same code, one phone | A failover from `DELIVERY_UNKNOWN`. **That must not happen** — it is the one classification rule S5.6 forbids. Read `otp_delivery_attempt` for that challenge and open a defect |
