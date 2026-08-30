# T7 report -- independent fact-check (two passes)

**Ran against:** `tier7/t7-phase-5-console`, and again after corrections
**Diff base:** `docs/build-status/T7-REPORT.md` as drafted
**When:** T7, before PR #24 merged
**Findings applied in:** `1c86e02`, `a671026`, `2188e30`
**Register entries produced:** None directly; it corrected the report and prompted the MT-KEYS regeneration.

> **THE REVIEW TEXT IS LOST.** It ran in a session and was never committed;
> no artifact of it survives in the tree or on disk. What follows is a record
> of WHAT it found, written at T8-R from the commit that applied its findings
> and from the register entries it produced -- not a reconstruction of its
> reasoning, and not its words.
>
> The correction list above is recoverable because each correction is visible in the report's own diffs; the fact-checker's evidence for each is not.

## What it found

Two passes over the T7 report itself, checking every claim against the tree.

Between them they found **sixteen false or overstated claims**, including:

- a `/dev/states` route asserted twice and defined nowhere;
- "every screen renders through ScreenState" when exactly one did;
- a header answering *"renders at 1280 and 360: yes"* for a check no browser ever made;
- "118 owners -> 118 persons" unsupported by anything in the tree;
- `D-58's two rows` where one row is D-58's and the other A1.2's;
- "the document's 109" where ADU-DB-01 v1.12 prints 112 over an enumeration of 109;
- PR numbers claimed as merged that were not;
- and an MT-KEYS drift the report called hypothetical that the repair commit had caused an hour earlier.

## How to read this

Each finding above resolves to a register entry or to a named commit, and those
are the evidence that survives. The measurements the reviewer made -- the
tables, the offsets, the response codes it compared -- are gone. Where this
file states an outcome, the outcome is checkable in the tree; where it would
have stated a measurement, it states nothing.
