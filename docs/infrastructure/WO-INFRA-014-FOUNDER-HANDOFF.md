# WO-INFRA-014 -- Founder handoff (short version)

**The primary document:** `docs/overnight/OVERNIGHT-INFRA-CLOSURE-HANDOFF-2026-11-13.md`.

## What is done
- **The infrastructure-only candidate:** verified and offered to `main` as **draft PR #105**, green on
  its merge commit.
- **The MinIO move:** preflight passes and rollback is ready.
- **The API tests can no longer touch the development database.** The guards are proven live; CI marks
  its own disposable database. A teardown audit fails any new kind of orphan.
- **The development database's 192 orphaned rows:** traced to the tests. A repair is written and
  rehearsed on a copy, ending with every foreign key holding.
- **Reviews:** two independent reviews; every finding fixed or recorded.

## What waits for you, in order
1. **Approve PR #105**, then run `WO-INFRA-010-POST-MERGE-VERIFICATION.md`.
2. **Approve the MinIO move** (`WO-INFRA-011-MIGRATION-EXECUTION.md`), preferably from the Work checkout
   after step 4.
3. **Approve the development-database repair** (`WO-INFRA-013-REPAIR-PLAN.md`).
4. **The Work checkout:** commit and push its MOB-WO-0 local work; add `MINIO_HOST_PORT=9100` to its
   `.env`.
5. **Choose** which mobile foundation continues; WO-001 to WO-022 is the tested one.
6. **Production:** confirm whether it exists and is backed up.

## Where Mobile work continues
From `infra/wo-infra-010-014-closure`. Next: WO-019 (native verification), then WO-023 (Seller Companion
Order awareness). Details: `WO-INFRA-014-MOBILE-READINESS.md`.
