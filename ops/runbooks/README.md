# `ops/runbooks/`

Operational steps that are performed once, by a person, against something outside the
repository - so they cannot be a script and must not be lost in a pull request body.

| Runbook | Status |
|---|---|
| [`storefront-import.md`](storefront-import.md) | **Blocked** - needs the storefront repository URL (ADU-REPO-01 v1.2 S11 step 2) |
| [`grant-founder-operator.md`](grant-founder-operator.md) | **Ready** - run once the founder account exists (T4 Phase F) |
| [`billing-reconciliation.md`](billing-reconciliation.md) | **Ready** - per bank transfer (T6 Phase B, G1.7) |
| [`activate-market.md`](activate-market.md) | **Ready** - once per market (T13 Phase 3, ADU-AUTH-01 v2.6 S9.4) |

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

**It is the FOURTH hand-run privileged operation, and the runbook says so on its own first
screen** - beside the founder grant, billing reconciliation and identity attestation. Each
is a decision about the world that no code can make; each is one person acting alone. The
pattern is only visible if the members are counted, which is why the fourth one names the
other three instead of quietly joining them.

It also carries the two prerequisites for a SECOND active market that are not on the
document's own checklist: per-market OTP spend is not attributable in the installed schema
(the counter is platform-wide, so it over-counts and fires early rather than late), and
S10.2's sender-registration rule is only half-enforceable because the schema does not
carry WHERE registration is mandatory. Both are registered.

**Still owed:** the rest of the ADU-CON-02 S20.6 set - `rollback`, `restore-drill`,
`incident`, `sms-failover`, `key-rotation`, `db-upgrade`. Each needs a deployment that
exists. And `ops/render.yaml`, which S18 says "keeps infrastructure in the repo" and
which has never been written - deploy.md step 0.
