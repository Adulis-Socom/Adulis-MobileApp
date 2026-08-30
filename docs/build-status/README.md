# Build status — what these records are, and the rules they follow

Everything in this directory is a **record**, not a specification. Nothing here
governs; the ADU documents do. These files say what was found, what was built,
and what is still owed, so that a later reader can tell the difference between
a decision and an accident.

Four conventions have been paid for by defects. Each is stated here with the
entry that bought it.

---

## 1. Rulings name findings; the register assigns numbers

**A ruling document must not mint a `D-` number.** It names the finding in
words, and the register assigns the number when the entry is written.

ADU-RUL-03 S1's heading cites **D-105**, and `DOCUMENT_AUTHORITY.md` repeats
it — but no D-105 existed. The register skipped from D-104 to D-106, so the
citation pointed at nothing for as long as anyone cared to follow it. Writing
the entry then left two bad options: append it after D-124, where a reader
following the citation would not find it, or insert it at its numeric position
and stop being strictly append-only. T8-R chose the insertion, because a
reader looks for the number rather than the date — and that choice cost the
file its strongest property.

**The exception was taken deliberately and once.** D-105 stays where it was
inserted; D-127 is the note saying so.

The rule that comes out of it: a ruling that needs to point at a finding says
what the finding *is*. If the register has no entry for it yet, the ruling has
identified work, not a number.

> Bought by **D-127** (T8-C S1) and stated in WORK ORDER T8-C S4.

## 2. The register is append-only, and "accept current" is not a merge strategy

Entries are added at the end, and once an entry has reached `main` it is never
edited — including when it turns out to be wrong about something. A correction
to a landed entry is a **new entry** that says what the old one got wrong.

An entry still on its own branch has not been read by anyone and is corrected
in place, in a commit that says what was wrong and why it was caught. D-134
was: it attributed "Gate 20's boot smoke test" to D-123, and the line is
D-120's. It was found by checking this file's claims against the register
instead of against the entry that made them — which is the only way that kind
of error is ever found.

Two consequences worth stating, because both have been met:

- **On an append-only file, "accept current" and "accept incoming" are both
  wrong in the same way: they delete entries.** A register conflict between two
  branches is resolved by keeping *both* sides in numeric order and verifying
  that no line was lost against either parent.
- **Records are not rewritten when the world moves.** `T8-REPORT.md` and D-120
  both call the boot smoke test "gate 20" — true when written, false once
  `mt-keys` took that position. The gate is 21, and the fix is D-134, not an
  edit to either record.

> Bought by **D-134** (T8-C S3), and by the merge described in WORK ORDER T8-C S0.

## 3. A report written after the fact says so in its first line

A report assembled later from commit messages is a different artifact from one
written as the work happened, and a reader cannot tell them apart unless it
says. It must not be presented as contemporaneous.

The same rule forbids the other direction: **do not back-fill an entry by
invention.** D-25 and D-28 have no entries and will not get them. A fabricated
entry is worse than a missing one, because the next reader cannot tell which
kind they are holding.

> Bought by **WORK ORDER T8-R**, and applied throughout `reviews/`.

## 4. Cite a gate by its name, never by its position

`ops/scripts/gates.mjs` holds one list, run by both `pnpm ci:local` and CI.
Its positions were cited in five places, one of them inside a governed
document — so the list became append-only to protect numbers that should never
have been written down, and new gates land at the end regardless of subject.

`pnpm gates --list` prints the ids. Use them.

> Bought by **D-134** (T8-C S3).

---

## The files

| File | What it is |
|---|---|
| `DEFECT-REGISTER.md` | Every finding, append-only, one entry per finding |
| `RULINGS-NEEDED.md` | Decisions owed by the CEO, extracted from the register |
| `SECURITY-REVIEW.md` | Standing security posture and its open items |
| `TIER-STATUS.md` | What each tier delivered |
| `TIER-1-SPEC-GAPS.md` | Specification gaps found at Tier 1 |
| `T3`…`T8-REPORT.md` | One report per work order, written to the order's own report block |
| `reviews/` | Adversarial passes as committed artifacts — see its own README |
