# Runbook — standing staging up for the first time

**Status: BLOCKED.** Written when Phase 1 was parked for want of a hosting account; the
probe has since run against a real Render instance and **failed** (D-297), and the first
deploy has no `DATABASE_URL_MIGRATE` (D-298). **Nothing in it has been run.**
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

> # [!] BLOCKED — do not follow this runbook yet (T23 Phase 1, D-297 and D-298)
>
> Written before the provider probe could be run. The probe has since run against
> a real Render instance and **failed**, and two blockers stand between this page
> and a working staging server. Both need a founder ruling, not an edit.
>
> **D-297 — the migrations cannot run as a managed role.** `CREATE SCHEMA ...
> AUTHORIZATION`, `SET ROLE`, `CREATE TABLE` in a foreign-owned schema and 86
> `ALTER ... OWNER TO` statements all require the executor to be a superuser, or
> to hold membership it is never granted. Managed Postgres does not give you
> superuser. **Step 4's `pnpm db:migrate` stops at migration 0001 and rolls the
> whole run back**, so not one of the fifty migrations applies.
>
> **D-298 — the first deploy has no `DATABASE_URL_MIGRATE`.** Step 1 defers it to
> step 3, step 3 defers the roles to the first `db:migrate`, and step 4 *is* that
> deploy. The circle has no entry point. This blocks the deploy even if D-297 is
> fixed.
>
> Everything else below — the boundary, the extensions, the OTP file, the
> operator grant, what staging still cannot do — is unaffected and still correct.

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
| `DATABASE_URL`, `DATABASE_URL_JOBS`, `DATABASE_URL_MIGRATE` | three different roles — **step 3 creates them**, so leave these until then. **D-298: this is circular and unresolved** — step 4's pre-deploy needs `DATABASE_URL_MIGRATE` before step 3 can produce it |
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

Migration 01 creates all six roles `NOLOGIN`, because **a password in a migration is a
secret in git**. Granting LOGIN is a provisioning step, run once per environment against
the owner connection:

```sql
ALTER ROLE adulis_app     LOGIN PASSWORD '<generated>';
ALTER ROLE adulis_jobs    LOGIN PASSWORD '<generated>';
ALTER ROLE adulis_migrate LOGIN PASSWORD '<generated>';
```

Generate three different values, put each in the matching Render environment variable from
step 1, and **do not write them down anywhere this repository can reach**.

> Roles do not exist until `db:migrate` has run at least once. If these `ALTER ROLE`
> statements fail with "role does not exist", let the first deploy's pre-deploy run, then
> come back to this step.

---

## Step 4 — the first deploy

> **This step is where D-297 stops the deploy.** `db:migrate` fails at migration
> 0001 line 85 with `must be able to SET ROLE "adulis_migrate"`, and because
> node-pg-migrate runs the whole `up` in one transaction, nothing at all is
> applied. Do not work around it here; the fix is a privilege-model decision.

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
