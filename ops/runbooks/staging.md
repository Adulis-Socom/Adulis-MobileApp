# Runbook — standing staging up for the first time

**Status: ready to follow. Nothing in it has been run.** D-297 and D-298 are CLOSED by the T23 run: fifty migrations applied as `adulis_migrate`, non-superuser, `db:check` 16/0/0. The provisioning contract that makes it work is step 0 below.
**Frequency:** once. Redeploys are [`deploy.md`](deploy.md).
**Owner:** CEO. **Source:** WORK ORDER T23 S4/S5 · ADU-CON-02 v3.2 S18, S19 · `ops/render.yaml`.

---

## What staging is, stated rather than assumed

> **Staging is a real server on the internet with no confidentiality. Anyone who can read
> its logs can sign in as anyone. It is invite-only, it carries no real seller, and it is
> not publicly linked.**

That is the boundary, and everything below follows from it rather than from caution:

- **A real bank account, a real identity document and a real payout credential do not go
  on staging.** Not "should not" — the encryption keys are `generateValue`, nobody holds
  them, and the buckets are separate from production precisely so a mistake here is a
  mistake about nothing.
- **The console says so, on every screen including sign-in.** The environment banner reads
  its answer from `/v1/bootstrap`, so it describes the server you are actually talking to
  rather than the bundle you happen to have loaded.
- **It is invite-only by construction, not by a setting.** `seller_registration_enabled`
  is false, and it stays false — see step 6.

---

## Before you start

You need three things this repository cannot give you:

1. **A Render account**, with billing. Everything below is one `render.yaml` apply plus
   values you paste in.
2. **A phone that can receive nothing.** There is no SMS vendor (open item O-5b), so
   staging binds the fake adapter and the OTP never leaves the server. You read it off the
   instance. Step 7.
3. **Twenty minutes and a shell.** Two of the steps cannot be automated and one of them is
   the step that gets forgotten.

---

## Step 0 -- the provisioning contract, and it is the whole difference

**ADU-DB-01 v1.19 S4.4b.1, measured.** Fifty migrations ran under exactly these five lines
with `rolsuper=f`. Reproduced verbatim rather than referenced -- five lines are shorter
than a pointer to them, and a pointer is a second place to go stale.

```text
1  owner creates adulis_migrate with LOGIN and CREATEROLE
2  GRANT CREATE, CONNECT ON DATABASE <db> TO adulis_migrate
3  GRANT CREATE ON SCHEMA public TO adulis_migrate
4  ALTER ROLE adulis_migrate SET createrole_self_grant = 'set, inherit'
5  do NOT create the other five roles -- 0001 must
```

> ### [!] Line 5 is a PROHIBITION, not a sequencing note
>
> **Do NOT pre-create the five roles. `0001` must.**
>
> `createrole_self_grant` grants membership only in roles **the role itself creates**.
> `0001:60-62` guards role creation with `IF NOT EXISTS`, so if you create them first,
> **`adulis_migrate` creates nothing, receives nothing, and holds zero membership in the
> other five.**
>
> **The GUC stays set. It stays visible in `SHOW`. It grants nothing.**
>
> An earlier version of this runbook let the first deploy create the roles and was
> therefore **right by accident** -- it read as a sequencing convenience, so the obvious
> tidy-up was to provision all six together up front. That tidy-up breaks the deploy
> silently. **A step whose correctness depends on nobody doing the obvious thing will
> eventually be done**, which is why the reason is written here beside the instruction
> rather than in a document somebody may not open.

**Line 3 fails before `0001` is read.** `CREATE TABLE "public"."pgmigrations"` ->
`permission denied for schema public`. PostgreSQL 15 revoked `PUBLIC`'s `CREATE` on
schema `public`, and `CREATE` on the DATABASE is a different privilege.

**Both halves of line 4 are required** -- `set` alone fails in `0001` on
*permission denied for schema verification*; `inherit` alone fails on
*must be able to SET ROLE "adulis_verification"*.

---

## Step 1 — apply the blueprint

`ops/render.yaml` describes the whole topology: `adulis-staging-db`,
`adulis-staging-api` (one instance), `adulis-staging-worker`, `adulis-staging-console`.

**Its first line says `THIS FILE HAS NEVER BEEN APPLIED`. Delete that line in the same
commit as your first successful apply, and only then.** It is the file's own honesty
about itself, and `pnpm verify:render-yaml` notices when it goes.

Render will prompt for every `sync: false` value. **None of them is in this repository and
none of them should ever be:**

| prompt | what to give it |
|---|---|
| `DATABASE_URL_MIGRATE` | **`adulis_migrate`, created by step 0** — it exists before the first deploy, which is what closes D-298's circularity |
| `DATABASE_URL`, `DATABASE_URL_JOBS` | `adulis_app` and `adulis_jobs` — **created by migration `0001`**, so these are filled in at step 3, after the first deploy |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | the Cloudflare R2 credentials for the **staging** buckets |
| `R2_MEDIA_PUBLIC_ORIGIN` | the public origin of `adulis-staging-media` |
| `SMS_PRIMARY_API_KEY`, `SMS_SECONDARY_API_KEY` | anything — no vendor exists, and nothing reads them |

> **The three database URLs are three ROLES, not three copies of one string.** Render
> synthesises exactly one connection string, for the owner role it created. Pasting it
> into all three collapses the privilege boundary that makes the verification and
> financial functions testable — and it would pass every test, which is why this is called
> out here rather than left to be noticed.

---

## Step 2 — the four extensions

Render's managed Postgres does not run an init directory, so `db/init/00-extensions.sql`
is run by hand, once, against the **owner** connection Render gave you:

```bash
psql "$OWNER_URL" -v ON_ERROR_STOP=1 -f db/init/00-extensions.sql
```

---

## Step 3 — give the runtime roles a password

Migration `0001` creates **five** roles `NOLOGIN`, because **a password in a migration is
a secret in git**. Granting LOGIN is a provisioning step, run once per environment against
the owner connection:

```sql
ALTER ROLE adulis_app  LOGIN PASSWORD '<generated>';
ALTER ROLE adulis_jobs LOGIN PASSWORD '<generated>';
```

**`adulis_migrate` is not in that list and must not be.** It was created with `LOGIN` at
step 0, before the first deploy, because the deploy connects as it.

Generate three different values, put each in the matching Render environment variable from
step 1, and **do not write them down anywhere this repository can reach**.

> These two roles do not exist until `db:migrate` has run, which is correct and is **not**
> a circularity: `adulis_migrate` already exists from step 0 and is what runs the deploy.
> If they fail with "role does not exist", the first deploy has not completed yet.

---

## Step 4 — the first deploy

The blueprint's `preDeployCommand` runs both steps that nothing else will:

```
pnpm db:migrate && pnpm worker:install
```

**`worker:install` is not part of `db:migrate` and cannot be** (D-52). It installs
graphile-worker's tables as the DDL role, because the worker's own first statement would
be `create schema if not exists jobs` — which needs `CREATE` on the *database*, a standing
privilege the runtime role must not hold. **A worker started without it boots, logs
healthy, and fails on its first task.** Nothing expires, nothing is reconciled, and no
seller sees a symptom for hours.

---

## Step 5 — ask the environment what it can do

```bash
DATABASE_URL_MIGRATE=... node ops/scripts/check-environment.mjs
```

Every finding names **what is blocked**, not what is missing. Expect this to fail the
first time, on step 6 and step 7's work. That is the point of running it before you
believe the deploy worked.

---

## Step 6 — the market

`pnpm db:seed` is **not** how a real environment gets a market: it creates a fixture
(`SEED`, two sellers, five orders) designed for the e2e harness, and a staging server that
carries seeded orders will eventually have someone reason from them.

Create the market properly instead, following
[`activate-market.md`](activate-market.md), which is the runbook that owns these columns
and explains each one. In short: one row in `core.market`, `activation_state = 'ACTIVE'`,
`otp_enabled = true`, currency and timezone set for the country.

> **`seller_registration_enabled` STAYS FALSE.** The launch gate is green *because* it is
> false, and that gate is the flag's first and only reader — open seller signup while
> nothing about a seller is measured is exactly what it exists to prevent. Staging is
> invite-only in the same way production is: you create the account, by signing the person
> in. Do not "fix" this to make sign-up easier for yourself.

---

## Step 7 — sign in once, then grant the operator

**This is the step that gets forgotten, and its absence is silent.**

**7a. Sign in.** Open the console, enter your phone number, and read the code off the
server — there is no SMS vendor, so the fake adapter writes it to a `0600` file:

```bash
# on the API instance's shell
cat "${DEV_SMS_LOG:-.dev-sms.log}"
```

> **This is why `ops/render.yaml` pins the API to ONE instance.** With two, the code is on
> whichever instance answered and you have an even chance of reading an empty file.
>
> **The code is deliberately not in the logs.** ADU-RUL-03 S1.1 makes the logger the only
> egress and puts the code and the phone on `NEVER_LOG` — and D-290 records the limit of
> that protection: it removes *fields*, and a secret interpolated into a message string
> would pass straight through. The file keeps it off stdout entirely, which is the only
> version of this that holds.

**7b. Grant yourself the operator role**, following
[`grant-founder-operator.md`](grant-founder-operator.md).

**Why this cannot be skipped, and why nothing will tell you that you skipped it:**
`core.operator_grant` has existed since migration 05 with nothing granting from it, and it
cannot be seeded — an account is created by the ordinary phone-OTP path, so no migration
can reference one. `verification.read_attestation` derives `actor_role` from that table.
**With no rows, nobody can review an identity** — and identity review is one of the ten
publication-readiness items, so **no seller can ever publish anything.** Claim review and
the moderation queue fill the same way. Nothing errors. Nothing logs. The queues just
grow.

Grant the **narrowest role that does the job**. `IDENTITY_REVIEWER` is what identity
review needs; `ADMIN` because it is simpler also hands over claim decisions and
moderation, and the access log will record every one of them against a role you did not
need.

---

## Step 8 — run the check again, and expect a pass

```bash
DATABASE_URL_MIGRATE=... node ops/scripts/check-environment.mjs
```

`PASS  no blockers`. If the worker heartbeat is the only warning, give it five minutes —
it beats every five and `/healthz` says `degraded` until it does, which is D-51 working:
**a stale worker reddens the body, never the status code.** A 503 for a dead worker would
pull every healthy API instance out of rotation and turn "orders stop expiring" into "the
storefront is down".

---

## Step 9 — confirm the console knows where it is

Open the console and look at the top of the sign-in screen. It must say **Staging**, and
it must say what that means.

If it says nothing, the console is talking to a server that reports `production` — check
`VITE_API_BASE_URL` on the static site. **The banner is read from the wire on purpose:**
it describes the API you are actually calling, not the environment the bundle was built
for, and those differ exactly when it matters most.

---

## What staging still cannot do

Written here so the first person through is not surprised:

- **Send an SMS.** No vendor (O-5b). Every sign-in needs a shell. This is the single
  biggest difference from production and the reason staging is invite-only in practice as
  well as in policy.
- **Take a payment, or pay one out.** No provider is integrated; the payment path is
  seller-confirmed by design, and payout credentials should not be entered here at all.
- **Serve a storefront.** `apps/storefront` is unstaffed and not in this blueprint.
- **Be promoted to production.** `ops/render.yaml` describes staging only, deliberately: a
  blueprint carrying two environments before either has ever been applied doubles the
  number of untrue statements in the file. Production is written the day staging has been
  applied once and the file's first line has been deleted.
