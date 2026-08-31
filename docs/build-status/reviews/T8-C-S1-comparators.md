# Adversarial pass -- T8-C S1 (comparators)

**Ran against:** 3869b0f (`tier8/t8c-comparators`), the diff against `main`.
**Performed by:** a fifteen-agent pass under a refute-by-default protocol --
a finding survived only where every verifier independently failed to refute
it. Six were raised against this PR; one survived.
**Written before** the fix it prompted.

---

## F1 -- MAJOR -- D-126 cites eight red checks; the gate reports twelve

D-126's Action says:

> The same attack was run against `verify:permission-doc` and it went RED on
> eight checks

A reviewer re-planted the attack instead of reading the claim: removing every
line mentioning `seller.reviews:read` from the S16.2 table
(`ADU-AUTH-01_..._v2_5.md`) and from the S16.2a SQL
(`amendments/ADU-AUTH-01_v2_4_permission_seed.sql`).

**Reproduced independently before acting on it**, in this repository, with
the planted files restored afterwards and the tree verified clean:

```
$ node ops/scripts/verify-permission-doc.mjs
  FAIL  the ASCII table parsed 42 rows  41
  FAIL  the generated SQL parsed 42 permissions  41
  FAIL  the generated SQL parsed 139 grants  133
  FAIL  the ASCII table parsed 139 grants  133
  FAIL  OWNER             holds 42  got 41
  FAIL  ADMIN             holds 40  got 39
  FAIL  SALES_SUPPORT     holds 19  got 18
  FAIL  INVENTORY         holds 16  got 15
  FAIL  ANALYST           holds 10  got 9
  FAIL  CAMPAIGN_MANAGER  holds 12  got 11
  FAIL  twelve permissions are mobile-reachable
  FAIL  OWNER holds all 42
FAIL  12 check(s) failed.
exit 1
```

Twelve, and the script prints the number itself. `seller.reviews:read` is
declared `ARRAY['MOBILE','CONSOLE']` and granted to all six roles, so beyond
the four count checks it trips every per-role total, the mobile-reachability
pin and the OWNER-holds-all pin.

**The entry's conclusion survives** -- `verify:permission-doc` was never
exposed, and twelve is a stronger result than eight. What fails is the
evidence, in an entry whose Effect line badges itself MEASURED and whose
authority rests on its numbers having been observed rather than assumed.

The entry's own next clause implies twelve: "pins 42 permissions, 139 grants,
six per-role totals" is 4 + 6 before the last two pins are counted. "Eight"
appears to be the neighbouring "eight step-up codes" bleeding across.

**Verdict: CONFIRMED. Corrected in place**, the entry not having reached
`main` (docs/build-status/README.md S2).

---

## Refuted

Five findings did not survive. The ones worth naming, because each looked
right:

- *"`EXPECTED_ROWS = 16` can be satisfied by malformed input parsing to 16
  rows"* -- refuted: the parse is anchored to the S1.1 table's column rows,
  and a malformed table yields fewer, not sixteen.
- *"the pin cannot see a row renamed on both sides"* -- true, and not a
  defect of the pin: the both-directions name comparison already catches a
  rename on one side, and a coordinated rename on both is a rename, not a
  loss. The gate's subject is membership, and membership is what the count
  guards.
- *"three forms agree' is printed even when only two were compared"* --
  refuted by reading the script: the third form is the live schema, queried
  unconditionally before that line is reached.
