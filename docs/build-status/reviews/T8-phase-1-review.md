# T8 Phase 1 -- adversarial review (D-105, the NODE_ENV boundary)

**Ran against:** `tier8/t8-phase-1-node-env`, commit `6b082eb`
**Diff base:** `e67bb48` (the T7 Phase 5 merge)
**When:** T8 Phase 1, around PR #25
**Findings applied in:** `77e0032` (as carried), corrected in `511339d`
**Register entries produced:** None. D-106 and D-107 came from the phase itself, not from a review.

> **THE REVIEW TEXT IS LOST.** It ran in a session and was never committed;
> no artifact of it survives in the tree or on disk. What follows is a record
> of WHAT it found, written at T8-R from the commit that applied its findings
> and from the register entries it produced -- not a reconstruction of its
> reasoning, and not its words.
>
> Whether those two findings came from an agent pass, from the CEO, or from both is not recorded anywhere I can check.

## What it found

**No review of Phase 1 was completed in this repository.** The pass launched
against `6b082eb` was stopped before it produced a result, and its transcript is
empty.

Two findings nevertheless reached the work, relayed in the T8 Phase 2 order as
*"Carried from #25's review"*:

- `build-tool-env.ts` depended on import order and nothing asserted it -- a
  formatter or bundler reshuffling imports would break the guard silently, and
  the symptom is a contract emitted from a process that should have refused to
  start.
- `.dev-sms.log` wanted a restrictive file mode and truncation at boot.

Both were applied in T8 Phase 2's commit `77e0032`, and the first was found to
be **unsound** by the Phase 2 review -- the assertion could not detect the
reordering it named, because with the imports swapped `app.module` throws during
its own evaluation and the check never runs. It was replaced with a dynamic
import in `511339d`.

## How to read this

Each finding above resolves to a register entry or to a named commit, and those
are the evidence that survives. The measurements the reviewer made -- the
tables, the offsets, the response codes it compared -- are gone. Where this
file states an outcome, the outcome is checkable in the tree; where it would
have stated a measurement, it states nothing.
