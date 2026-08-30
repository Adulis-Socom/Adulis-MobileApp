# T8 Phase 4 -- adversarial review (the age declaration)

**Ran against:** `tier8/t8-phase-4-age`, commit `69a17e2`
**Diff base:** `9fad3d7` (the Phase 3 merge)
**When:** T8 Phase 4, before PR #28 merged
**Findings applied in:** `686a30b`
**Register entries produced:** D-121, D-122, and the in-place correction of D-119.

> **THE REVIEW TEXT IS LOST.** It ran in a session and was never committed;
> no artifact of it survives in the tree or on disk. What follows is a record
> of WHAT it found, written at T8-R from the commit that applied its findings
> and from the register entries it produced -- not a reconstruction of its
> reasoning, and not its words.
>
> The attack transcripts -- the exact green run that defeated the gate, the offsets in the shipped bundle -- are gone.

## What it found

Six findings. The one that matters: **the gate the phase exists to add could
be defeated by deleting one comment.** The HUMAN-REQUIRED class was defined
entirely by markers in `am.ts` -- the file the translation pass rewrites -- so
removing the marker and supplying an Amharic string passed green, and the gate
printed a SMALLER count as though a shrinking class of legally-binding strings
were unremarkable.

Also: the refusal was sticky (a standing refusal rendered under the next error,
and "Change number" carried a TICKED box to the next number's code step, which
is the one thing the ruling names); the gate repaired what it checked, so a
re-run turned red into green with the fix unstaged; the new gate had been
INSERTED mid-list, silently renumbering five live references including
ADU-RUL-03 S5.2's own "Gates 17 and 18"; a JSDoc above a key was attributed to
the key before it; and reading values from raw source picked up apostrophes in
comments.

It also answered the question it was asked to settle: the OTP challenge is
consumed BEFORE the age check in program order, but both run in one transaction
and the refusal rolls the consume back -- so a refused person's code is not
burnt. The first attempt at this review stalled without producing anything and
left an untracked probe file in the tree; the second produced the findings
above.

## How to read this

Each finding above resolves to a register entry or to a named commit, and those
are the evidence that survives. The measurements the reviewer made -- the
tables, the offsets, the response codes it compared -- are gone. Where this
file states an outcome, the outcome is checkable in the tree; where it would
have stated a measurement, it states nothing.
