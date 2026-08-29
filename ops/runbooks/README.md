# `ops/runbooks/`

Operational steps that are performed once, by a person, against something outside the
repository - so they cannot be a script and must not be lost in a pull request body.

| Runbook | Status |
|---|---|
| [`storefront-import.md`](storefront-import.md) | **Blocked** - needs the storefront repository URL (ADU-REPO-01 v1.2 S11 step 2) |
| [`grant-founder-operator.md`](grant-founder-operator.md) | **Ready** - run once the founder account exists (T4 Phase F) |
| [`billing-reconciliation.md`](billing-reconciliation.md) | **Ready** - per bank transfer (T6 Phase B, G1.7) |

**Written at T4 Phase F.** The founder operator grant is now
[`grant-founder-operator.md`](grant-founder-operator.md). It could never have been a
migration: no founder account id exists until someone signs up through the ordinary
phone-OTP path, and a grant is a decision about a person recorded in an append-only table.

**Added at T6 Phase B.** Reconciliation is [`billing-reconciliation.md`](billing-reconciliation.md).
ADU-DB-01 S18.5 calls it "operator work outside this contract" and no document names a
surface for it, so G1.7 built the enforcement - `billing.fn_reconcile_purchase`, which
derives its authority from `core.operator_grant` - and granted `EXECUTE` to no runtime
role at all. A runbook is what "outside this contract" looks like once it is literal.

**Still owed:** the ADU-CON-02 S20.6 set - `deploy`, `rollback`, `restore-drill`,
`incident`, `sms-failover`, `key-rotation`, `db-upgrade`. Each needs a deployment that
exists.
