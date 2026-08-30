# T8 Phase 2 -- adversarial review (the server-minted device)

**Ran against:** `tier8/t8-phase-2-device`, commit `77e0032`
**Diff base:** `b2a6ead` (the Phase 1 merge)
**When:** T8 Phase 2, before PR #26 merged
**Findings applied in:** `511339d`
**Register entries produced:** D-111, D-112 (and it prompted the corrections recorded in D-108-D-110).

> **THE REVIEW TEXT IS LOST.** It ran in a session and was never committed;
> no artifact of it survives in the tree or on disk. What follows is a record
> of WHAT it found, written at T8-R from the commit that applied its findings
> and from the register entries it produced -- not a reconstruction of its
> reasoning, and not its words.
>
> The reviewer ran a live API and measured each finding; those measurements are gone.

## What it found

Verdict: **do not merge.** Ten findings.

The blocker: `POST /v1/auth/otp/request` derives its anonymous idempotency actor
from `X-Adulis-Device`, the header the phase had just stopped the console from
sending -- so sign-in failed at step one, and the 400 named a header the ruling
forbids the console to send. Every test passed because every test still sent it.

Also found: a CONSOLE verify never checked that the cookie's device was a WEB
row or an unclaimed one (a session could be anchored to a row whose platform
said ANDROID, and a cookie naming another account's device was refused the bind
but given a session anyway); a malformed cookie reached a uuid column and 500'd
an unauthenticated caller; minting was an unauthenticated unbounded write
measured at ~230 rows/second; the no-configuration branch set no cookie at all,
making console sign-in permanently impossible on a migrated-but-unseeded
database; `.dev-sms.log`'s `mode: 0600` was a no-op on an existing file;
`generate-openapi`'s new assertion could not detect the reordering it claimed to
assert; and the new suite's weakest assertion guarded the phase's central
invariant.

## How to read this

Each finding above resolves to a register entry or to a named commit, and those
are the evidence that survives. The measurements the reviewer made -- the
tables, the offsets, the response codes it compared -- are gone. Where this
file states an outcome, the outcome is checkable in the tree; where it would
have stated a measurement, it states nothing.
