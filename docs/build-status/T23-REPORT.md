# T23 REPORT - Finish It, Then Put It Somewhere

**Order:** T23 - "Finish It, Then Put It Somewhere"
**Phase 1 PARKED** (no hosting credentials). **Phases 3, 4 and 5 complete.**
**Phase 2 part done, and this says which part and why the rest was left.**
**Unattended, no reviewer.**

---

## The answer first

**Nothing was deployed, because there was nothing to deploy to.** Phase 1's probe
needed a real hosting provider and this machine has no Render credentials of any
kind -- no environment variable, no `render` CLI, no `~/.render`, no
`ops/render.yaml`. The order named that phase its **only STOP condition** and
said what to do: *"PARK the phase, say so, and continue to Phase 2 -- do not
simulate it."* It is parked. **Every use of the word "staging" in this report and
in these six pull requests names a CONFIGURATION, not a URL.**

**Which made the order's own priority ruling the one that mattered:** *"Phases 1
and 4 matter more than a complete Phase 2. A console at 96% on a server beats one
at 100% on a laptop."* Phase 1 could not be done, so Phase 4 got the window, and
the eleven-component port did not. That is a scheduling decision and it is argued
at the bottom rather than implied.

**Six pull requests. Twenty-five of twenty-six gates green.** The twenty-sixth is
`boot-smoke`, red on this machine because `msedge.exe --dump-dom` produces zero
bytes against `data:text/html,<h1>hi</h1>` -- no server, no policy, no bundle
(D-293). The gate is untouched.

**And one of the six pull requests is not T23's work at all.** T22's five phases
were all merged -- **into each other**, never into `main`. `main` has been sitting
at Phase 1 with four phases and a report stranded on a branch with no route home.
Found while placing this order's first branch in the stack. PR #93 is that route.

---

## The five findings this order did not go looking for

Each is the same shape as T22's three: **a guarantee that was true where it was
written and false where it was needed.**

| | |
|---|---|
| **D-288** | Three gap sentences promised a **name** that `core.person` is built never to store -- and the console's own trade screens already said so correctly, as policy. One product decision, told two ways, and **the wrong way outnumbered the right one three to two** |
| **D-290** | The test proving a staging OTP never reaches the logger **passed with the violation planted**. Chasing that found the real limit: `NEVER_LOG` removes **fields**, and `msg` is allow-listed with nothing reading its contents |
| **D-291** | The console's CSP named **two hostnames that have never existed**, typed a second time beside the variables the build already had. Fixed twice at *serve* time, in two harnesses, never in the artifact |
| **D-294** | `core.operator_grant` is empty in **every environment that has ever existed, including this laptop's** -- and the consequence is that no seller can ever publish anything, silently |
| **D-296** | `pnpm ci:local` is red **one run in three**, with a 429 in a different spec each time. D-273's shape with a **counter** as the third shared resource -- and it is the ninth instance D-280 predicted a worker cap would hide |

---

## Phase 1 - PARKED, with the instrument verified

The order asked for ADU-CON-02 S18.2's four-step capability probe against a real
Render trial instance. **There is no such instance and no credentials to make
one.** Searched: the environment, `~/.render`, `~/.config/render`, the shell
history, `ops/`, and the repository for any provider reference. Nothing.

The order was explicit about what not to do: *"Do not work around it. A
workaround invented unattended, on the privilege model, is the worst possible
artifact of this window."*

**What was done instead is labelled for exactly what it is.** `ops/provider-verify/probe.sql`
has existed since ADU-CON-02 S18.2 and had never been run in twenty-two orders,
so it was run **against the local container as an instrument check**: exit 0, all
five capabilities PASS, `TEARDOWN PASS: no probe_ roles or schemas remain`.

**That is not a provider result and must not be read as one.** The local
`adulis_bootstrap` role is a superuser (`rolsuper: true`) -- which is precisely
the property the probe exists to test the *absence* of on a managed provider. All
the run establishes is that the probe executes cleanly and cleans up after
itself. It is an instrument that has now been fired once.

---

## Phase 2 - two rulings landed, the port not started

### D-284 is ruled and fixed: two sellers, on two accounts

The seed carried one seller, and one seller could not be both subscribed and
unsubscribed. SC-07's cap counter needs a subscription to resolve a limit at all;
SC-26's e2e is titled *"honest about having none"* and asserts exactly that
absence. T22 tried the subscription, broke two screens, reverted, and registered
the question. The founder's ruling: seed both.

| seller | subscription | demonstrates |
|---|---|---|
| `seed-store` | none | SC-26, and SC-12's entitlement arm |
| `seed-store-beta` | BETA | SC-07: **cap 10, binding LEVEL, level NEW** |

**Two accounts, not one, and that is not tidiness.** `chooser.spec` asserts a
single-store seller is taken straight into their store -- D-97's closure -- and
its own comment states the fixture property it rests on. The first attempt hung
the second seller off the same account and **turned four chooser tests red on the
first run.**

**Two gates caught this before any assertion did**, which is them working:

1. `db:reset` refused with `sellers: expected 1, got 2`. Its `EXPECTED` map is a
   transcription of what the seed defines, so the counts moved together with the
   reason written beside them.
2. The second sign-in was refused **403 by ADU-API-01 S5.1's Origin check**,
   correctly. `browser.newContext()` merges the config's `use.storageState`
   unless the option is given a *value* -- `undefined` reads as "not specified" --
   so the new context arrived carrying the **first** account's session cookie, and
   a cookie-carried write with no Origin is exactly what that control refuses.

### D-285 gets the gate its fix deserved

T22 fixed the console to read the focus token. It did not answer the larger
question: **the ring was one of sixty-nine variables, any of which could be
defined, verified and unread.** Rule 5's guard asserts a ring is *visible*; it
never asks whether the ring is the *token's*.

`apps/console/e2e/tokens-are-read.spec.ts` reads `tokens.css` per mode and
compares it to `getComputedStyle`. **Three tokens, not sixty-nine**, because
three are the three ways a token gets consumed: a whole **declaration** (the
ring, measured on a real Tab-focused element), a **colour** (the accent -- the one
D-285 bypassed), and a **set** (the danger triple, where the failure is one
hardcoded of three). A gate asserting all sixty-nine would be a transcription of
`tokens.css` with a browser attached, stale the day a token is renamed.

**Proven to fire twice, and the second plant is the entire case for the dark
project:**

| planted in `console.css` | light | dark |
|---|---|---|
| `outline: 3px solid #1e40af` (D-285 verbatim) | **RED** | **RED** |
| `outline: var(--adu-focus-ring-width) solid #1e40af` | green | **RED** |

A hardcoded light accent is indistinguishable from a correct one in light mode
and wrong in dark. Expected `rgb(138, 176, 255)`, painted `rgb(30, 64, 175)`.

### The port was not started, deliberately

Eleven components, twelve `ScreenState` treatments, five screen layouts: **not
attempted.**

D-287 measured that work in T22 and ruled on the shape of a partial attempt. Only
three of the eleven exist as components today; the other eight are element
selectors across 37 files (**94 raw `<button>`, 38 raw `<input>`**); Button and
Input must go **last**, because until every call site is migrated the bare
`button`/`input` rules must stay alive -- otherwise every unmigrated control loses
its 44x44 touch target in the same commit that introduces the component meant to
guarantee it.

And D-287's ruling: *"an eleven-component port started and abandoned mid-way
leaves the console in two design systems at once"*, which is the state T22 S5's
own ruling exists to prevent.

**So the choice was between a complete port and none, and the order ranked
Phase 4 above a complete Phase 2.** Six of eleven would have been the one outcome
worse than not starting.

---

## Phase 3 - ten sentences, and one fact that changed three verdicts

All ten re-checked against what the server returns **today**, not carried forward
on T20's triage. **Six KEEP, three FIX, one DELETE.**

The FIX is one fact, found in a table definition:

```
core.person   id, id_hash, id_hash_key_version, created_at
core.account  id, phone_e164, market_id, person_id, status, age_declared_*, ...
```

**There is no name column anywhere for a person** -- not a buyer, not a courier,
not the human behind a seller. A store has a `store_name`; a person has nothing.

So three sentences said a name was *"not reported by the server **yet**"* about a
field no server will ever report, and each set a seller waiting for a release
that is not coming. **And the console already knew better, two screens away:**
`trade.orders.no_buyer_name` states it correctly, as policy. BETA-READINESS's own
triage even flagged the trade pair as *"not a gap sentence at all"* -- and did not
notice that three other sentences were making the opposite claim about the same
absence.

**The DELETE is the one the order names.** `insights.analytics.export_owed`
advertised a paid feature (Business) on a screen where it cannot be bought, and
the plan comparison does not sell it either. **Either sell it or say nothing.**
D-226's rule is untouched and is written where the sentence used to be: an export
exists in no wire, and a control faked at a 404 is worse than an absence. The
absence stays; the advertisement goes.

**Three e2e assertions caught the change before I did**, which is them working --
they assert this copy verbatim, and all three went red on the first run.

The six KEEPs were each re-verified rather than assumed. `insights.trust.wire_owed`
is kept **and deliberately untouched**: trust is a founder-owned engine this order
forbids touching, stubbing, extending, designing or registering against.

---

## Phase 4 - the topology, in the repository, saying it has never run

### D-289 - `ops/render.yaml`, seventeen orders after D-80

D-80's reason for leaving the file out was good and is why it stayed open:
*"inventing a `render.yaml` that has never been applied would be a file that
looks authoritative and has never been true."* Phase 1 went looking for the
account that would settle it and parked. **The objection still stands, so the
file answers it rather than ignoring it** -- its first line is
`THIS FILE HAS NEVER BEEN APPLIED`.

What makes it more than a draft is `pnpm verify:render-yaml`. It **cannot** check
that Render accepts the schema, and it prints that limitation rather than
implying otherwise. It checks the claims that **rot** between writing a file and
running it -- and all six checks were proven to fire by planting each violation:

| check | the failure it catches |
|---|---|
| every script and entry point exists | `worker:install` renamed; a worker with no tables **boots, logs healthy**, fails on its first task (D-52) |
| `healthCheckPath` is served **and `@Public`** | D-79: without `@Public` it answers 401 to Render, every instance is unhealthy, no deploy goes live |
| pre-deploy runs both steps, from **one** service | two services migrating race each other |
| every `.env.example` variable declared | a service that starts, then throws on the first request that needs it |
| no secret carries a literal value | a blueprint is where "just paste the key in for now" happens |
| every `fromService` resolves | a typo that silently yields an empty value |

Three decisions in the file are argued where they are made. The three
`DATABASE_URL`s are `sync: false` because **Render synthesises one connection
string and this platform needs three roles** -- collapsing them would make every
privilege check in the schema untestable *and would pass every test*. The API is
pinned to **one instance** because the OTP lands on the instance that answered.
The static console declares **no `NODE_ENV`**, because Vite picks React's
development build from it.

### D-290 - the instrument that could not see the thing it ruled out

The obvious test captures `process.stdout.write` and searches it for the code.
**pino writes through SonicBoom straight to fd 1 and never touches it**, so the
capture was blind and the green meant nothing.

Chasing that found the larger thing:

> `NEVER_LOG` removes **fields**. `msg` is allow-listed and **nothing reads its
> contents**, so a code interpolated into a message passes every control this
> repository has.

`sms.adapter.ts`'s own comment is true of the field and false of the sentence.
The limit is now asserted **in both directions** -- the structured field is
removed, the same value inside `msg` survives. Not a bug asserted as correct; a
**limit written down**, so nobody reaches for "the logger redacts it" as a reason
to log a secret.

**Which decides where staging's OTP goes.** The founder's boundary -- *"anyone
who can read its logs can sign in as anyone"* -- says what staging is **worth**,
not that an OTP may go on a log line. ADU-RUL-03 S1.1 is a governing document and
this window is unattended, so the code goes where development already puts it: a
`0600` file, off stdout, outside every container log aggregator.

### D-291 - a policy naming two origins that had never existed

`connect-src 'self' https://api.adulis.example https://media.adulis.example`,
typed a second time beside the variables the build already had. D-164 and D-276
are both that drift, fixed twice at **serve** time and never in the artifact.

Now substituted at **build** time. Every directive is still *written*, not
assembled (ADU-CON-02 S3.9), and the script asserts the directive list it wrote
is the one it read.

**The first version refused an unset variable, and `ci:local` failed within a
minute.** `pnpm build` is a does-it-compile build with neither set. The principle
survives in a better form: **the policy names exactly the origins the build was
given**, and a bundle with no `VITE_API_BASE_URL` cannot reach an API either, so
the two still agree.

### The rest of Phase 4

- **`NODE_ENV=staging` in the closed set**, with the guard audit written out in
  `env.ts` and two of its entries asserted. Adding a value silently flips every
  `=== 'production'` guard to its permissive branch -- the exact failure that file
  exists to prevent. The existing spec used `'staging'` as its example of an
  *unrecognised* value and went red on the first run, which is a test doing its job.
- **The environment banner**, served from `/v1/bootstrap` and rendered **above
  the router** so it covers **sign-in** -- where a real phone number gets typed
  into the wrong server. Served rather than built in, because what matters is
  which API the seller is *actually* talking to. Asserted in both modes; rule 4
  satisfied by words, not tone.
- **`TRUSTED_PROXY_HOPS`** as a validated **count**, never a boolean. It does
  **not** re-enable the IP limiter; ADU-AUTH-01 S15.1 wants three things and this
  is one of them.
- **Separate R2 buckets**, because a staging server with no confidentiality
  writing into the production evidence bucket is a data incident with no attacker
  in it.
- **`/healthz` was already correct** (D-51, T4) and is verified, not changed.

---

## Phase 5 - the step that gets forgotten, said by a command

**D-294.** `core.operator_grant` cannot be seeded, and that is correct. **What
nothing said is what happens when it is skipped:**
`verification.read_attestation` derives `actor_role` from that table, so with no
rows **nobody can review an identity** -- and identity review is one of the ten
publication-readiness items, so **no seller can ever publish anything.** Claim
review and moderation fill the same way. **Nothing errors. Nothing logs.**

**This laptop's database has had it wrong for twenty-three orders.** The check's
first run found it here.

`ops/scripts/check-environment.mjs` is the runbook line turned into a command.
**Every finding names what is BLOCKED, not what is missing** -- "0 operators" is
a fact nobody acts on; "no seller can publish" is the same fact with its
consequence attached. It also reports `seller_registration_enabled = false` as
**OK, explicitly**, because the launch gate is green *because* it is false.

**One of its findings was wrong on its first run, and the fix is the more useful
half:** it reported `citext` missing against a healthy database, because the
extension list had been typed from memory. It now reads the list out of
`db/init/00-extensions.sql`. *A checklist that invents an item is worse than no
checklist.*

**And the seed can no longer be mistaken for a market.** `seed.mjs` refused
`production` alone -- a negated guard, and Phase 4 added a value after it. The
list is enumerated now, so **staging is refused**. A staging server carrying five
seeded orders is one where somebody eventually reconciles one, quotes it in a bug
report, or shows it to a person deciding whether the product works.

**D-295.** `ops/runbooks/staging.md`: nine steps from an empty Render account to
a console that says **Staging** on its own sign-in screen. It opens by *stating*
the boundary rather than assuming it, says why each of the three un-automatable
steps cannot be automated, and ends with **what staging still cannot do** -- send
an SMS, take a payment, serve a storefront, or be promoted to production. Its
status line says *"Nothing in it has been run."*

---

## What was NOT done

- **Phase 1's provider probe.** No credentials. Parked, not simulated. It is the
  one thing that must happen before any of Phase 4 becomes true of a server.
- **The eleven-component port, the twelve ScreenState treatments, the five screen
  layouts.** Argued above: the choice was between complete and none, and the order
  ranked Phase 4 higher.
- **`boot-smoke` is red on this machine**, for a reason that is not the console
  and not this order (D-293). **The gate is untouched** -- loosening an assertion
  to get a green on one laptop is how a gate becomes decorative. CI runs
  `ubuntu-latest`; `verify:console-e2e` drives the same built `dist` in the same
  browser over CDP, 88 green.
- **Nothing was deployed.** No server exists.
- **D-296 was not fixed.** A reproducible one-in-three 429 across concurrently
  running specs, found by running `ci:local` at the end of the order. Four causes
  eliminated by measurement, and the remaining hypothesis -- `consume` runs on
  the pool rather than the caller's transaction, so the increment survives a
  rollback -- is written down as a hypothesis rather than as a cause, because the
  last three orders each lost time to a cause recorded before it was
  established. Nothing was changed: a 429 that appears once in three runs is
  exactly the red that gets "fixed" by a retry or a cap, and both would hide it.

---

## What needs you

1. **Merge #93 first.** T22's phases 2-5 and its report have no route to `main`
   and have not had one since they were merged into each other. Everything in
   this order is stacked on top of that.
2. **A Render account**, so Phase 1's probe can run and `ops/render.yaml` can
   stop saying it has never been applied. Until then Phase 4 is configuration
   that has never met a server.
3. **A ruling on the port** (D-287, restated). It is now the only substantial
   piece of the console that is not done, it cannot be done halfway, and it wants
   a window of its own rather than the tail of one.
4. **Two related rulings from D-296.** Should the rate limiter's `consume` run
   inside the caller's transaction -- which decides whether a failed attempt is
   free -- and does D-280's worker-cap question change now that its predicted
   ninth instance has appeared? This entry is evidence for **not** pinning the
   cap yet: it would buy a green gate and lose the only signal that this exists.
5. **A small ruling from D-290**: should `applyAllowList` scan `msg` for the
   shapes it already refuses as fields -- a six-digit code, an E.164 number? It
   would catch that class rather than documenting it, and it risks a redaction
   that fires on an order reference. Not decided here.
6. **Grant yourself the operator role on your own machine.** `core.operator_grant`
   is empty here too, and it has been for twenty-three orders.
