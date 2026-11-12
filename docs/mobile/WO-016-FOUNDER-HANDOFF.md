# WO-016 -- Founder Handoff

Messaging UX, accessibility and reliability. 12 November 2026.

## Result

- **The keyboard no longer hides the conversation (ON-20261111-164).** With the keyboard open and
  enlarged text (checked at 1.0, 1.3 and 1.6), the newest messages, the attached Product, the
  message box and Send all stay on screen. The composer scrolls on its own and Send never scrolls
  away. Native testing found a second cause (B-008, Send under the keyboard), which was fixed and
  checked again.
- **Refusals no longer guess (ON-20261111-168).** When the server answers "not found" to a send, the
  app says the conversation or the Product may not be available and keeps your text. It says a
  Product is gone, or a conversation is not available, only when a fresh read shows it.
- **Unconfirmed sends are explained.** "Your message may already have been received. Trying again
  checks the same message, so it is not sent twice. Editing it makes a new message, which could
  arrive twice." The button reads **Try sending again**. Natively, a message sent offline and then
  retried was stored exactly once.
- Failures are announced to screen readers.

**iOS was not tested.**

## Branch and commits

`mobile/wo-016-messaging-ux-reliability`, from `67c48bbad70cc4c9f1a7e600bfd4ea88d062975f` (the
WO-015 checkpoint). Checkpoint HEAD: see the batch handoff.

| Commit | Change |
|---|---|
| `09bbce3` | locale: the unconfirmed explanation, Try sending again, the neutral refusals (own commit) |
| `1c15fca` | mobile: the composer layout, the neutral 404, the clearer unconfirmed send |
| `b0602eb` | test: the WO-016 cases; the fake API's timeout behaviour |
| `8ffa1d8` | mobile: keyboard offset (B-008); Maestro layout flow |
| `3bbf927` | mobile: security-review fixes (L1, L2) |
| next | docs |

## Tests

- **Jest:** chat.test.tsx 67/67; mobile 400/400 (22 suites).
- **Native:** the layout at three font scales, Light and Dark, with and without the keyboard,
  history, and a Product attached and removed; the unconfirmed path with the API stopped and the
  retry. All PASS after B-008. The first failing run is recorded.

## Security

An independent read-only review of `67c48bb..8ffa1d8` found **no Critical, High or Medium issue**.
Its checks:
- idempotency is preserved;
- a re-send after a 404 still re-reads the Product first;
- the neutral refusal leaks nothing;
- session boundaries hold;
- announcements are fixed sentences;
- `useHeaderHeight` is safe here.

Two Lows were fixed in `3bbf927` (S-003): screen readers now hear the same refusal the screen
shows, and "Edit the message instead" is ignored while a send is in flight.

## Bugs (details in `docs/overnight/WO-015-017-ISSUES-AND-BLOCKERS.md`)

- B-008 (HIGH, fixed): Send under the keyboard after the first layout change.
- B-007 corrected: the launcher "hang" was the Metro subshell holding a piped caller; fixed.
- B-006 confirmed fixed: Metro now writes its file-map cache.
- S-003 (fixed).

## Decisions for the founder

None new. B-003 (memory pressure during native tests) remains.

## Storage (bytes free)

| Point | C: | G: |
|---|---|---|
| Before development | 38,200,033,280 | 3,358,022,696,960 |
| After testing (emulator running) | 27,974,156,288 | 3,357,414,522,880 |
| After cleanup | 27,974,012,928 | 3,357,655,695,360 |

- **Generated:** WO-016 Maestro evidence and logs on G:.
- **Removed:** 32 unused Maestro driver APKs (WO-016 SSD temp), dry run first.
- **Recovered:** 245,366,784 bytes on G:.
- **Protected:** untouched.
- The C: drop is the running emulator (it comes back when the emulator stops; see B-003).
