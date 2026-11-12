# WO-017 -- Founder Handoff

Buyer frontend stabilization and accessibility. 12 November 2026.

## Result

- **Failures are now spoken (A-001, HIGH).** Screen-reader users previously heard nothing when, for
  example, a sign-out or a Save failed. 25 messages and 4 screen-level failures now announce
  themselves.
- **Offline is said as offline (A-002).** Messages, a conversation, Notifications, Signed-in
  sessions and Saved no longer show "Loading" forever without a connection.
- **Search reads fully (A-003, A-004).** Results include the Seller and trust level, and "no
  results" is spoken.
- **Keyboard fix extended (A-005):** Delete Account, Sign in and Verify.
- **The For You native flow works (ON-20261111-084).** It passed twice on its own data.
- **The five navigation journeys pass natively.** For You to a conversation, a Shop category to a
  conversation and back, Search to Messages, Saved to Ask Seller, and You to Messages and back.
- **Storage audit (ON-20261111-170):** the JSON was correct and my WO-014 reading was wrong. Both
  outputs now print one removed total, by drive.
- **Remaining (A-006, LOW):** busy states shown by opacity only, scroll-only paging in public
  lists, Product names cut to two lines in tiles, and focus loss on Seller Profile tabs and Delete
  Account steps.

**No screen reader was run** (TalkBack is not automated here; announcements are Jest-verified).
**iOS was not tested.**

## Branch and commits

`mobile/wo-017-buyer-frontend-stabilization`, from `a610a413f9fa9f666d9123678e4fbc4888f826dd` (the
WO-016 checkpoint). Checkpoint HEAD: see the batch handoff.

| Commit | Change |
|---|---|
| `39d5abe` | ops: the storage audit's removed totals (ON-170) |
| `7a27128` | mobile: accessibility and offline fixes (A-001 to A-005) |
| `04d68d8` | test: AlertText, announced failure, offline private list; Search labels |
| `ae34634` | test: For You flow hardening (ON-084), journeys flow, Search flows |
| `bd2b8ca` | mobile, ops: security-review lows (S-004); journey j4 and Search flow corrections |
| `0ed2ed7` | test: the You tab tap retried after launch (B-013) |
| next | docs |

## Tests

- **Jest:** mobile 403/403 (23 suites); new: `AlertText.test.tsx`, chat "A-001", "A-002"; the
  Search label assertions check the Seller and trust phrases.
- **Native (WO-017 battery and reruns):**
  - For You: PASS twice (own data).
  - Journeys j1 to j5: PASS (j4 after a flow correction).
  - The WO-014 Product-context journeys, layout, notifications and messaging: PASS.
  - Selector: PASS after the You-tab retry.
  - 17 regression flows: PASS (Search after its pattern update).
  - First failures are recorded in the issues file (B-012, B-013).
- **Gates at `0ed2ed7`:** see the batch handoff, Testing.

## Security

An independent read-only review of `a610a41..ae34634` found **no Critical, High or Medium issue**.
It confirmed four things:
- every new announcement is a catalogue sentence or `failureMessage`: no phone, code, token, raw
  server text or internal id;
- the header-height hook is called before any early return;
- the offline wording never shows stale data or hides an expired session;
- the audit script still deletes only verified Maestro APKs, and only with `-Execute`.

Two Lows were fixed in `bd2b8ca` (S-004): no doubled alert role, and a path-root parser in the
audit. Re-announcements when a row remounts are accepted as Info.

## Decisions for the founder

None new. B-003 (memory pressure during native tests) and the pending decisions listed in the batch
handoff are unchanged.

## Storage (bytes free)

| Point | C: | G: |
|---|---|---|
| Before development | 27,969,122,304 | 3,357,644,161,024 |
| After testing (emulator running) | 27,927,961,600 | 3,354,373,652,480 |
| After cleanup (emulator stopped) | 38,141,784,064 | 3,355,695,906,816 |

- **Generated:** WO-017 Maestro evidence and logs on G:; the For You fixture media in MinIO,
  removed after the flow.
- **Removed:** 193 unused Maestro driver APKs from the WO-017 SSD temp folder, dry run first. The
  audit's text and JSON agree: 193 files, 1,223,379,041 bytes, all on G:.
- **Recovered:** 1,223,379,041 bytes on G: (the removed files; the drive's free space also moved
  with other activity).
- **Protected:** untouched.
- C: rose when the emulator stopped (B-003).
