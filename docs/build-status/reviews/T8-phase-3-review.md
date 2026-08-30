# T8 Phase 3 -- adversarial review (the market from the device)

**Ran against:** `tier8/t8-phase-3-market`, commit `8bf2dc6`
**Diff base:** `cbafc96` (the Phase 2 merge)
**When:** T8 Phase 3, before PR #27 merged
**Findings applied in:** `d9aada8`
**Register entries produced:** D-118. (D-116 and D-117 came from the phase itself.)

> **THE REVIEW TEXT IS LOST.** It ran in a session and was never committed;
> no artifact of it survives in the tree or on disk. What follows is a record
> of WHAT it found, written at T8-R from the commit that applied its findings
> and from the register entries it produced -- not a reconstruction of its
> reasoning, and not its words.
>
> The six measured cells, and the pre-change SQL run that dated the regression, are gone.

## What it found

Its worst finding was a **security regression introduced by the phase**: the
new refusal fired when `coalesce(account market, device market)` was NULL, which
made it depend on whether the phone had an account. `POST /v1/auth/otp/resend`
-- public, unthrottled, no idempotency key -- answered 202 for a registered
number and 400 for an unregistered one, and both deletion endpoints did the
same. ADU-AUTH-01 S22 forbids exactly that, and `otp.service`'s own header says
so. The reviewer measured all six cells and ran the pre-change SQL to establish
that the divergence was new rather than pre-existing.

Also: `requestingDevice` preferred the client's header over the httpOnly cookie
on every surface, letting a web caller choose which market's `otp_ttl` and
`otp_max_attempts` governed a phone -- including the value S22's lockout counts
against; c6 had become coupled to owning the earliest live market, from which
the reviewer reproduced D-104's exact recorded symptom; and the new suite's two
live markets reached into other suites, whose rows its teardown deleted.

## How to read this

Each finding above resolves to a register entry or to a named commit, and those
are the evidence that survives. The measurements the reviewer made -- the
tables, the offsets, the response codes it compared -- are gone. Where this
file states an outcome, the outcome is checkable in the tree; where it would
have stated a measurement, it states nothing.
