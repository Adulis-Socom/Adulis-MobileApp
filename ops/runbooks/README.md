# `ops/runbooks/`

Operational steps that are performed once, by a person, against something outside the
repository - so they cannot be a script and must not be lost in a pull request body.

| Runbook | Status |
|---|---|
| [`storefront-import.md`](storefront-import.md) | **Blocked** - needs the storefront repository URL (ADU-REPO-01 S11 step 4) |

**Not yet written, and owed:**

- **The founder operator grant.** ADU-DB-01 S6.11 E4: no founder account id exists in any
  document, `core.account` has no seed, and a grant referencing an account that does not
  exist would have to invent one. The founder account is created by the ordinary phone-OTP
  path like any other, and the grant is a documented step at **Tier 4**, taken once against
  the real account id and recorded here.
