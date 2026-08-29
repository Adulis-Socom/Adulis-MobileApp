# Runbook — reconciling a subscription payment

**Status:** ready to run. **Frequency:** per bank transfer, by hand.
**Owner:** CEO. **Source:** ADU-API-01 v1.7 S12.12 (G1.7) · ADU-DB-01 v1.12 S18.5 ·
migration `0033_purchase_intent_and_reconciliation.sql`.

---

## Why this is a runbook and not an endpoint

ADU-DB-01 S18.5 says reconciliation is **operator work outside this contract**, and it
means it: no document names a surface, a role or a screen for it, and register D-36
records the gap rather than filling it. T6 built the *enforcement* — the function that
decides whether a payment may activate a subscription — and deliberately did **not**
invent the endpoint that would have called it.

So `billing.fn_reconcile_purchase` exists, is owned by `adulis_migrate`, has
`EXECUTE` revoked from `PUBLIC`, and is granted to **no runtime role at all**.
`adulis_app` cannot call it; `adulis_jobs` cannot call it. That is what "outside this
contract" looks like when it is made literal instead of merely written down.

> **The function still checks who you are.** Being able to open a psql session is not
> authority. `fn_reconcile_purchase` reads `core.operator_grant` itself and raises
> `U0001` unless the actor holds a **live `ADMIN` grant** — the same derivation
> `verification.write_attestation` uses (T5 §2.1). Run
> [`grant-founder-operator.md`](grant-founder-operator.md) first if nobody holds one.

---

## What you are reconciling

Two rows, and they are not the same object:

| | |
|---|---|
| `billing.purchase_intent` | **A quote with a clock.** What was bought (tier, term), what it was priced at, which `price_schedule` row that price came from, and when the quote dies — **24 hours** after it was opened |
| `billing.collection_record` | **The obligation.** The row you match a real bank line against. It carries the amount, the currency, and eventually `reconciled_at` / `reconciled_by` / `provider_ref` |

The seller sees the reference `ADU-SUB-XXXXXXXX` — the first eight characters of the
**collection record id**, upper-cased. That string on a bank transfer is how you find the
row.

---

## Before you start

1. **You have the bank statement line in front of you.** Amount, currency, and the
   reference the payer typed. Reconciling from a seller's message rather than from the
   bank is how a subscription gets activated for money that never arrived.
2. **You have the DDL credential** (`DATABASE_URL_MIGRATE`).
3. **You hold a live `ADMIN` operator grant**, and you know your own `core.account.id`.

---

## The steps

### 1. Find the record

```sql
SELECT cr.id,
       cr.amount_minor, cr.currency,
       cr.marked_transferred_at,          -- the seller's own assertion
       cr.reconciled_at, cr.voided_at,    -- both NULL = still open
       pi.tier, pi.term, pi.expires_at,
       (pi.expires_at > now()
        AND pi.reconciled_at IS NULL
        AND pi.cancelled_at IS NULL)      AS intent_is_live,
       s.seller_id
  FROM billing.collection_record cr
  LEFT JOIN billing.purchase_intent pi ON pi.collection_record_id = cr.id
  JOIN billing.subscription s ON s.id = cr.subscription_id
 WHERE upper(left(cr.id::text, 8)) = 'XXXXXXXX';   -- from ADU-SUB-XXXXXXXX
```

**Check the amount against the bank line before you go on.** The function does not, and
cannot: it has no view of your bank.

### 2. Reconcile

```sql
SELECT billing.fn_reconcile_purchase(
  '<your-account-id>'::uuid,     -- must hold a live ADMIN operator grant
  '<collection-record-id>'::uuid,
  'CBE-20260829-000123');        -- the bank's own reference, verbatim
```

One transaction stamps the record, closes the intent, and moves the subscription to
`ACTIVE` carrying the rate **from the intent** — never re-derived from whatever the
schedule says today. It returns the subscription id.

### 3. Confirm

```sql
SELECT state, tier, term, locked_rate_minor, locked_rate_currency,
       price_schedule_version_id, current_period_start, current_period_end
  FROM billing.subscription WHERE id = '<returned-id>';
```

---

## When it refuses

Every refusal below is `SQLSTATE 23001` (`restrict_violation`) except the first.

| Message | What happened | What to do |
|---|---|---|
| `permission denied` (`U0001`) | You hold no live `ADMIN` operator grant | [`grant-founder-operator.md`](grant-founder-operator.md) |
| `out of scope` (`U0002`) | No collection record with that id | Re-read the reference off the statement |
| `collection record already closed` | It is already reconciled, or it was voided | Read `reconciled_at` / `voided_at` and `void_reason`. **Do not force it** |
| `purchase intent is not live` | The quote expired (24 h), was cancelled, or the record never had one | **Ask the seller to open a new intent** and reconcile against that. See below |

### The expired-quote case, which is the common one

A seller who transferred on day three against a quote from day one has paid a real
amount against a dead price. **Do not edit `expires_at`.** The rate lock is the whole
point of the clock: reviving the quote charges them at a price that is no longer the
price. Instead:

1. Ask the seller to open a fresh intent for the same tier and term
   (`POST /v1/billing/purchase-intent`). If the new price differs, that difference is a
   commercial conversation, not a database edit.
2. Reconcile the **new** record with the same bank reference.
3. The old record closes on its own: `subscription.collect_reminder` runs
   `billing.fn_close_stale_collections()` on every tick, which voids the expired
   intent's record with `void_reason = 'EXPIRED'` — **unless the seller had marked it
   transferred**, in which case it stays open precisely so it does not disappear from
   under you. Void that one by hand once the money is accounted for:

   ```sql
   UPDATE billing.collection_record
      SET voided_at = now(), void_reason = 'SUPERSEDED_BY_NEW_INTENT'
    WHERE id = '<old-collection-record-id>'
      AND reconciled_at IS NULL AND voided_at IS NULL;
   ```

---

## What is deliberately absent

- **No bulk path.** The signature takes one record and cannot express a sweep. A
  reconciliation run that touched a hundred rows would be one mistake with a hundred
  consequences, against real money.
- **No "reconcile without an intent".** A payment with no intent behind it cannot decide
  a tier, a term or a rate, so it must not decide a state. Record it in your own books
  and get an intent opened.
- **No endpoint, and no grant to `adulis_app`.** Granting `EXECUTE` to the API role would
  create the operator surface by accident — a surface no document has specified.
