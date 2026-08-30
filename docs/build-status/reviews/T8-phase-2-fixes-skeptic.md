# T8 Phase 2 -- skeptic pass over the fixes

**Ran against:** `tier8/t8-phase-2-device`, commits `511339d` and `712f6ea`
**Diff base:** `77e0032` (the change the fixes repair)
**When:** T8 Phase 2, before PR #26 merged
**Findings applied in:** `02219a5`
**Register entries produced:** D-113, D-114, D-115.

> **THE REVIEW TEXT IS LOST.** It ran in a session and was never committed;
> no artifact of it survives in the tree or on disk. What follows is a record
> of WHAT it found, written at T8-R from the commit that applied its findings
> and from the register entries it produced -- not a reconstruction of its
> reasoning, and not its words.
>
> Its measurements -- the 500s, the 40-rows-in-141ms, the file mode -- are gone.

## What it found

A second pass, over the FIXES rather than the change. Eight of ten held.
**Two did not, and both were mine.**

- The idempotency actor took the browser cookie **verbatim** into
  `core.idempotency_record.actor_id`, a uuid column -- so a malformed cookie
  answered 500 on any anonymous idempotent endpoint, including `otp/request` and
  `POST /v1/devices`. This is the same defect the fix had just closed at
  `otp/verify`, re-opened one door along, and the test written for it covered
  only the door that was fixed.
- The device-ownership guard was scoped by `body.audience === 'CONSOLE'`, and
  the audience is a field the caller fills in: `audience: 'MOBILE'` with another
  account's WEB `device_id` walked past it and minted a session on a stranger's
  browser row.

It also established that `mode: 0600` buys nothing on Windows (Node maps mode to
the read-only bit; ACLs inherit), and that `POST /v1/devices` remained an
unlimited anonymous write one endpoint from the one that had just been limited.

## How to read this

Each finding above resolves to a register entry or to a named commit, and those
are the evidence that survives. The measurements the reviewer made -- the
tables, the offsets, the response codes it compared -- are gone. Where this
file states an outcome, the outcome is checkable in the tree; where it would
have stated a measurement, it states nothing.
