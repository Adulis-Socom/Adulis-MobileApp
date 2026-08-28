# Runbook — the founder operator grant

**Status:** ready to run. **Frequency:** once per operator, by hand.
**Owner:** CEO. **Source:** ADU-DB-01 v1.10 S6.11 (register E4) · ADU-AUTH-01 v2.4 S20.

---

## Why this is a runbook and not a migration

`core.operator_grant` has existed since migration 05 with **nothing granting from it**, and
that is not an oversight — it cannot be seeded:

- **No founder account id exists until someone signs up.** `core.account` has no seed row
  and never will: an account is created by the ordinary phone-OTP path (`POST
  /v1/auth/otp/verify`), like every other account. A migration referencing an account id
  would have to invent one.
- **A grant is a decision about a person**, and the table that records it is append-only
  with `granted_by_account_id` and a `reason`. That is the shape of an audited human act,
  not of a schema default.

**T4's SR-1 follow-on sharpened the consequence.** Now that migration 0025 has properly
restricted the boundary functions, `verification.read_attestation` derives `actor_role`
from `core.operator_grant` — **and there are no operators**, so identity-verification
review cannot happen at all. The same is true of claim review and the moderation queue:
every one of those queues fills, and nothing in-product drains it.

> **This is the one privileged action taken by hand, and it is recorded in an append-only
> table for exactly that reason.** Nothing revokes it silently either: `revoked_at` is a
> second act by a second person, and the row survives both.

---

## Before you start

1. **The person must already have an Adulis account.** Have them sign in once on the
   console (phone → OTP). No account, no grant.
2. **Decide the role, and grant the narrowest one that does the job.** The catalogue is
   five values and they are not interchangeable:

   | `core.operator_role` | What it is for |
   |---|---|
   | `SUPPORT` | Buyer/seller support queues |
   | `MODERATOR` | The `core.moderation_queue_item` queue — reports, prohibited keywords |
   | `CLAIM_REVIEWER` | Claim decisions (`core.claim.decided_by`) |
   | `IDENTITY_REVIEWER` | **Reads identity attestations** — `verification.read_attestation` accepts only this and `ADMIN` |
   | `ADMIN` | All of the above |

   **`ADMIN` is not the default.** An `IDENTITY_REVIEWER` grant is what a person needs to
   review identity; giving them `ADMIN` because it is simpler hands them claim decisions
   and moderation as well, and the access log will faithfully record every one of them
   against a role they did not need.

3. **You will need the DDL credential** (`DATABASE_URL_MIGRATE`). `adulis_app` holds
   `SELECT` on `core.operator_grant` and no `INSERT`, deliberately — the API cannot grant
   operator powers, because no endpoint should be able to.

---

## The step

**1 — find the account id from the phone number.** Never guess it, and never grant to a
phone number: the grant is on the account, and the phone is only how you find it.

```sql
SELECT id, phone_e164, status, created_at
  FROM core.account
 WHERE phone_e164 = '+2519XXXXXXXX';
```

Confirm exactly one row, `status = 'ACTIVE'`, and that the `created_at` matches when that
person told you they signed up. **If you get zero rows, stop** — they have not signed in,
and the fix is for them to sign in, not for you to create an account.

**2 — record who is granting it.** `granted_by_account_id` is your own account id, found
the same way. It is nullable in the schema only because the very first grant has nobody
above it; use it every other time.

**3 — insert the grant.**

```sql
INSERT INTO core.operator_grant
  (id, account_id, role, granted_by_account_id, reason)
VALUES (
  gen_random_uuid(),
  '<account id from step 1>',
  'IDENTITY_REVIEWER',              -- the narrowest role that does the job
  '<your account id from step 2>',  -- NULL only for the very first grant
  'Founder operator, T4 Phase F. Identity review for the beta cohort.'
);
```

**4 — verify it from the outside**, as the function that will use it does:

```sql
SELECT g.role, g.granted_at, a.phone_e164
  FROM core.operator_grant g
  JOIN core.account a ON a.id = g.account_id
 WHERE g.revoked_at IS NULL
 ORDER BY g.granted_at;
```

---

## Revoking

**Never `DELETE`, and never `UPDATE` the row's meaning.** `core.operator_grant` is
append-only — a trigger refuses both — and revocation is a stamp on the existing row:

```sql
UPDATE core.operator_grant
   SET revoked_at = now(), revoked_by_account_id = '<your account id>'
 WHERE id = '<grant id>' AND revoked_at IS NULL;
```

> The append-only trigger blocks `UPDATE` **as adulis_app**. Revocation is performed with
> the same DDL credential as the grant, and is the same kind of act: a person, recorded.

---

## What this does NOT do

- **It does not give anyone an operator surface.** ADU-OPS-01 is a separate deployment
  (ADU-CON-01 R6) and does not exist. Until it does, an operator's powers are reachable
  only through the boundary functions, called with their account id — which means claim
  review, moderation and identity review are **founder work performed against the database
  by hand**, and are not endpoints.
- **It does not create an impersonation path.** "Operator impersonation" is one of the
  eleven load-bearing absences: there is no column, no endpoint and no session mechanism
  by which an operator becomes a seller. An operator reads and decides; they never act as
  someone else.
- **It grants nothing in `verification` or `financial` at the SQL level.** The role is
  *derived inside* the boundary functions from this table (R5); it is not a database role
  and confers no table privilege anywhere.
