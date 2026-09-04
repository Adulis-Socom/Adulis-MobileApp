# `ops/runbooks/`

Operational steps that are performed once, by a person, against something outside the
repository - so they cannot be a script and must not be lost in a pull request body.

| Runbook | Status |
|---|---|
| [`storefront-import.md`](storefront-import.md) | **Blocked** - needs the storefront repository URL (ADU-REPO-01 v1.2 S11 step 2) |
| [`grant-founder-operator.md`](grant-founder-operator.md) | **Ready** - run once the founder account exists (T4 Phase F) |
| [`billing-reconciliation.md`](billing-reconciliation.md) | **Ready** - per bank transfer (T6 Phase B, G1.7) |
| [`activate-market.md`](activate-market.md) | **Ready** - once per market (T13 Phase 3, ADU-AUTH-01 v2.6 S9.4) |
| [`deploy.md`](deploy.md) | **Ready** - every promote (T6 Phase D) |
| [`staging.md`](staging.md) | **Ready, never run** - standing staging up the first time (T23 Phase 5) |

**Written at T4 Phase F.** The founder operator grant is now
[`grant-founder-operator.md`](grant-founder-operator.md). It could never have been a
migration: no founder account id exists until someone signs up through the ordinary
phone-OTP path, and a grant is a decision about a person recorded in an append-only table.

**Added at T6 Phase B.** Reconciliation is [`billing-reconciliation.md`](billing-reconciliation.md).
ADU-DB-01 S18.5 calls it "operator work outside this contract" and no document names a
surface for it, so G1.7 built the enforcement - `billing.fn_reconcile_purchase`, which
derives its authority from `core.operator_grant` - and granted `EXECUTE` to no runtime
role at all. A runbook is what "outside this contract" looks like once it is literal.

**Added at T6 Phase D.** [`deploy.md`](deploy.md), written for the two steps nothing in
the repository can do for you: `pnpm worker:install`, which is not part of
`pnpm db:migrate` and cannot be, and giving the runtime roles a LOGIN password that
migration 01 deliberately withholds. Neither leaves a trace when skipped until something
is already wrong.

**Added at T13 Phase 3.** [`activate-market.md`](activate-market.md), because v2.6 S9.4
says "during founder-only MVP, market activation is a privileged founder-run operation"
and nothing in the product writes those columns.

**It joins the hand-run set and names that set on its own first screen**, because the
concentration is only visible if the members are counted. An earlier draft called it "the
fourth" and counted identity attestation among the three before it - wrong twice over:
identity attestation happens THROUGH THE PRODUCT (`POST /v1/seller/identity-verification`
calling `verification.write_attestation`), and `deploy.md`, which really is hand-run, had
been left out to make the number come to four. **A count that has to choose its members is
not a count**, so the page lists the set instead of numbering it.

It also carries the two prerequisites for a SECOND active market that are not on the
document's own checklist: per-market OTP spend is not attributable in the installed schema
(the counter is platform-wide, so it over-counts and fires early rather than late), and
S10.2's sender-registration rule is only half-enforceable because the schema does not
carry WHERE registration is mandatory. Both are registered.

**Added at T23 Phase 5.** [`staging.md`](staging.md), for standing a staging server up
the first time - and `deploy.md` is now listed above too, having been hand-run since T6
without appearing in its own index.

**It exists for one step, and the step is step 7b.** `core.operator_grant` cannot be
seeded: no account id exists until someone signs in through the ordinary phone-OTP path,
and a grant is a decision about a person recorded in an append-only table. So it is done
by hand, and **its absence is silent** - `verification.read_attestation` derives
`actor_role` from that table, so with no rows nobody can review an identity, and identity
review is one of the ten publication-readiness items. **No seller can ever publish
anything, and nothing errors, and nothing logs.** The queues just grow.

A runbook line saying "do not forget this" is a rule that holds until the week someone is
busy, so the runbook is paired with `node ops/scripts/check-environment.mjs`: the same
sentence, said by a command, against the database that is actually there. Every finding it
prints names WHAT IS BLOCKED rather than what is missing - "0 operators" is a fact nobody
acts on; "no seller can publish" is the same fact with its consequence attached.

**Still owed:** the rest of the ADU-CON-02 S20.6 set - `rollback`, `restore-drill`,
`incident`, `sms-failover`, `key-rotation`, `db-upgrade`. Each needs a deployment that
exists.

**`ops/render.yaml` is no longer owed** (T23 Phase 4, D-289). It exists, it has never been
applied, its first line says so, and `pnpm verify:render-yaml` checks every claim it makes
about this repository - though not, and it says so, whether Render accepts the schema.
