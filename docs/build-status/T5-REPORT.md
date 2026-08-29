# WORK ORDER T5 REPORT

```
WORK ORDER T5 REPORT
Documents installed: DB v1.12 - API v1.7 - AUTH v2.5 - CON-02 v3.1 - superseded moved: yes
Migration: 0027   old signature dropped: YES   owner: adulis_verification   PUBLIC execute: NO
Tests 1-7: 1 pass - 2 pass - 3 pass - 4 pass - 5 pass - 6 pass - 7 pass
db:check: 16/0/0   check 10: PASS (no definer is PUBLIC-executable; none owned by a superuser)
Consequence recorded: no attestation can be written until the founder grant is run: YES
Contradictions found in v1.12 / v1.7 / v2.5 / v3.1: 2, both in v1.12 - D-58, D-59
NOT done: the S5 list, confirmed untouched
```

**One change, one PR.** The PR is open and **not merged** -- S6 requires a human to read
this first, and branch protection would not stop a merge if I did it.

---

## The change

`POST /v1/seller/identity-verification` wrote an attestation from fields **the client
supplied**: the verifier, the reference, the legal name, the ID hash and the date. A
seller holding `seller.identity:manage` and a step-up code could assert their own ID
verification -- the IDENTITY eligibility path, and at Pro the verified badge. Open since
C6. It now returns **403 to every seller session**.

**The step-up was working perfectly the whole time, and that is the part worth keeping.**
It proved the person holding the phone was the account holder, which was never the
question. The question was whether anyone had checked the document, and nobody had. So
**test 1 supplies a genuine, fresh, correctly-actioned challenge** and asserts the 403
arrives anyway -- a test that failed at the step-up gate would prove nothing about this
change. It also asserts **no row was written**, because a 403 that still wrote the
attestation would be the worst of both: a refusal the caller believes and a row the
ladder reads.

### The trap, and what the migration does about it

The signature changes, so `verification.write_attestation` is a **new function object**.
`CREATE OR REPLACE` preserves owner and privileges only when the signature is identical;
add a parameter and PostgreSQL hands you a different function with its defaults --
**owned by whoever ran the migration, `EXECUTE` granted to `PUBLIC`** -- and leaves the
old one in place, still callable, still writing attestations from client-supplied fields.

Migration 0027 does four things: creates the new function, `ALTER FUNCTION ... OWNER TO
adulis_verification`, `REVOKE ALL ... FROM PUBLIC` then `GRANT EXECUTE` to `adulis_app`
alone, and **drops the old eight-argument signature by its full signature**. Tests 5 and
6 assert the last three directly rather than trusting the file, and check 10 asserts the
class. Verified after the fact: one overload, nine arguments, owner `adulis_verification`,
`public_exec=false`, `app_exec=true`.

> This is SR-1's defect with a fresh chance to happen, and D-50's beside it. The
> `REVOKE` is not hardening: `p_actor` is trustworthy **only** because exactly one role
> may call the function and that role always passes its own session's account. It is the
> precondition that makes the signature sound.

### The endpoint shape, as S2.3 specifies it

The gate is the function's own derivation from `core.operator_grant`, not
`fn_has_permission` -- an operator holds no seller relationship, so a seller-scoped check
would raise `U0002` (404) before the boundary function was reached, and tell the caller
the seller does not exist rather than that they may not act. So the endpoint:

- **does not require `X-Adulis-Seller`** -- a second, documented exemption in
  `requiresSellerContext`, beside seller creation. Both are paths under `/v1/seller` that
  no seller header can describe, for opposite reasons.
- **does not call `fn_has_permission`**.
- **calls `write_attestation` and lets it raise** -- `U0001` maps to 403 through the
  mapper already in place.
- takes **`person_id` in the body**, because an operator attests about someone else.

**The plumbing turned out to be buildable, so nothing was parked.** The guard already had
one exemption with a stated reason; this is the second, in the same shape.

### Two judgement calls, both recorded rather than assumed

**Step-up is RETAINED.** T5 S2.3 does not mention it either way. Removing a control that
works while closing a different one is the wrong direction, the mechanism is account-
scoped so an operator can mint their own challenge with no seller relationship, and
keeping it is what makes test 1 mean what S3 says it should mean. It is no longer *the*
gate; it is a second one.

**The response drops its `eligibility` block.** It named the **caller's** seller, and the
caller is no longer a seller. ADU-DB-01 v1.12 S7.3 is explicit that whether a new
attestation re-opens eligibility "is S7.4's business, evaluated by
`fn_evaluate_eligibility` at the moment it is asked." Returning one here would mean
resolving a seller from a person, which no document rules. **No client can be broken by
this**, and that is why it is safe rather than merely defensible: the only callers who
can now reach the endpoint are operators, and the operator surface does not exist.

---

## The consequence the work order asked to be stated, and one more

**S4's consequence, confirmed: nobody can write an identity attestation at all until a
real account holds an `ADMIN` or `IDENTITY_REVIEWER` grant.**
`ops/runbooks/grant-founder-operator.md` exists from T4 and **has not been run**. That is
the correct state -- the capability is post-beta and AUDIENCE carries admission -- and it
is now a known consequence rather than something discovered later. Tests use a fixture
grant created in the test's own transaction; **no grant is seeded in a migration**, per
E4.

**And one this work order surfaced -- D-57, MAJOR.** The old body created the
`core.person` row and set `core.seller.person_id`, for an individual seller verifying
themselves. Operator-only removes that, correctly. **Nothing else in the codebase writes
`core.person`** -- a grep confirms it; the only other reference is the company path,
which takes `representative_person_id` from the client.

So `core.fn_seller_attestation_person` resolves:

| Seller | Person comes from | After T5 |
|---|---|---|
| `COMPANY` | `seller_company_detail.representative_person_id` | **Works end to end.** An operator attests about the named representative |
| `INDIVIDUAL` | `core.seller.person_id` | **NULL forever.** No path writes it, so `IDENTITY_VERIFIED` can never be satisfied by an attestation and the IDENTITY eligibility arm can never be satisfied |

**Not urgent, and not invented around.** ADU-PRD-01 S4.1 admits a seller on either path,
`id_verification_requirement` is `OPTIONAL` in the Ethiopian configuration, and test 7
asserts an AUDIENCE-only seller is still `SATISFIED` -- the regression that would have
hurt most and would not have failed loudly. It becomes blocking the day a market sets
`MANDATORY_ALL`, or the day an individual seller needs the Pro badge. **The fix needs a
ruling on who links a person to an individual seller and by what act**, and inventing one
is what S2.3 forbids.

---

## Contradictions found in the four documents

**None in v1.7, v2.5 or v3.1.** Two in v1.12, both found by building it, and both are the
shape the document itself narrates twice.

**D-58 -- Appendix A omits the enum value v1.12 introduces.** `OPERATOR_ATTESTED` appears
four times in v1.12 -- the S0.1 ruling table, S7.3's ruling box, S7.3's prose -- and
Appendix A's catalogue row still reads `verification.verifier_kind | KYC_VENDOR,
VIDEO_CALL`. **Appendix C check 16 compares Appendix A against `pg_type` in both
directions**, so a database carrying the ruling disagrees with the appendix of the
document that ruled it. Green here only because check 16 reads
`db/checks/fixtures/appendix-a.json`, which this PR updates.

**D-59 -- Appendix B's reconciliation was declared and not performed.** S30 states
"D-18, D-40 ... Both exist. **Appendix B reconciled**." Appendix B names neither
`category_market_availability` nor `notification_preference`; it does not name
`seller_courier_invite` either, though S0.1's arithmetic counts it; and its core heading
reads **84** above a list of **85**. The appendix that opens *"the number is derived, not
asserted"* carries an asserted number that its own list contradicts.

> **v1.11 drew this lesson about itself and v1.12 repeats it in S0.2:** *"an assertion in
> prose that nothing executes will drift."* Both entries are corrections **announced in a
> change table and not performed in the body** -- which is, to the next reader,
> indistinguishable from one that was.

**One installation note rather than a contradiction.** T5's table says DB v1.12
supersedes **v1.11**; this repository governed at **v1.10 as amended by A3** and v1.11 was
never installed. v1.12 is a complete document and carries A3's three rulings in its own
S0.2 and S30, so nothing is lost -- but the jump is two revisions, and
`docs/amendments/README.md` now says so.

---

## Gates

| Gate | Result |
|---|---|
| Tests 1-7 | **7/7** -- and 1, 2, 3, 4 and 6 were watched failing against the current code first |
| Full suite | **363/363** |
| `pnpm db:check` | **16 PASS / 0 PENDING / 0 FAIL**, check 10 included |
| `pnpm db:determinism` | PASS -- two clean databases converge, 10,242 lines |
| `pnpm verify:permission-doc` | PASS -- 252 cells both directions, **unchanged**, which v2.5 S0.1 says is the outcome worth checking rather than assuming |
| `pnpm verify:docs-ascii` | PASS on all four installed documents |
| `pnpm ci:local` | exit 0 |

**Four tests elsewhere changed, and each is the same fact restated.** C1's
`identity verification` block asserted **201** for the Owner and now asserts **403** with
no row written; three boundary tests in `migration-04-05` called the old signature, and
**two of them seeded no operator grant at all** -- which is the hole restated as tests
that did not notice it.

---

## NOT done -- the S5 list, confirmed untouched

Verified against the built schema rather than asserted: `core.seller_courier_invite` does
not exist, and `core.product` has no `slug` column.

- the product slug (G1.9) - courier pending invites (G1.8) - conversation anchors (G1.10)
- the ladder `AND` rule and its two new columns (G1.2) - ownership transfer (G1.6)
- the subscription lifecycle (G1.7) - device market assignment (G1.11)
- closure-during-deletion-block (G1.3) - `POST /v1/conversations` (G1.10)
- D-30, D-33, D-34, D-44

Also not done, and not in scope: the founder operator grant itself (a hand-run
operational step, E4), and any KYC vendor.
