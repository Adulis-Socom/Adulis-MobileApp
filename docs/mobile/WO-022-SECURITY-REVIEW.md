# WO-022 -- Independent security review

12 November 2026. A separate reviewer reviewed the diff `e5e4a6e..cf79371` (locale strings, the
shared Chat send-outcome rule, the Seller messaging presentation). The review was read-only: no
edits, no tests run, no device. `apps/api`, `apps/console` and `apps/storefront` were not read.

**This is a frontend-only review. It certifies nothing about the backend.** In particular, the
backend's idempotency answers were not verified:
- to concurrent requests with the same key;
- to a failure after its transaction commits.

## Result

**No Critical, High or Medium finding.** There is one Low and four Info. The fixes are in commit
`0da543b`, with tests.

| ID | Severity | Finding | Outcome |
|---|---|---|---|
| S22-01 | Low | `sendOutcome` treated any JSON with a string `code` as the API's refusal. A CDN, load balancer or WAF answering `{"code": ...}` after the API stored the message would show "not sent", drop the key, and not re-read the history; the next Send could duplicate the message | **Fixed.** A refusal now needs the API's problem envelope: ProblemDto's required `title_key`, `request_id` and `retryable`, and a `status` equal to the HTTP status. Anything else is unknown. After a 5xx or 409 refusal (and a 404), the conversation is read again before anything new is sent (`rereadAfter`), on both sides. Tests: the `{ code }`-only case on both sides; the 5xx re-read. A mutation restoring the old rule fails both |
| S22-02 | Info | The refusal tests' fixture stored the message and then returned a 500 problem, so the tests passed with two stored copies | **Fixed.** The fixtures store nothing on an API refusal, and the tests count copies (exactly one after the next attempt) |
| S22-03 | Info | A retry whose Product was unpublished in the meantime can only end with "Edit the message instead". If the first message was stored, the edited (unanchored) one is a second copy. The re-read after the first unknown outcome shows the stored copy first | **Recorded** (W22-13, founder decision). A same-key replay of the unchanged Product id could be allowed once the backend confirms its replay answer for an unpublished Product |
| S22-04 | Info | A store name containing an unterminated bidirectional control (U+202E, U+2067) can reorder the rest of the "Conversations for {store} (@{handle})" line. Only that store's own members see it | **Recorded** (W22-14). Suggested non-destructive fix: wrap slot values in U+2068...U+2069 (first-strong isolate). Message bodies are separate text elements, so a body cannot reorder the sender label |
| S22-05 | Info | Leaving the conversation (back, another conversation, another store, the store disappearing) drops an unknown intent without an explicit choice. Retyping the same text is a new key | **By design** (W22-15). Nothing is persisted, and the history is re-read on reopening. An optional leave warning is a founder decision |

**Also noted, pre-existing (W22-16, Info).** A Product entered by a link while a send is frozen is
not applied after "Edit the message instead", because the entry was already consumed. The Buyer can
still choose it from Select Product.

## Specific checks

- **(a) An intermediary's problem-shaped body:**
  - Before the fix it was possible, though unlikely. Release builds use https, so only operator
    infrastructure can answer, and common gateway defaults use `message` or a numeric `code`.
  - Its impact is a duplicated chat message, no money.
  - Closed on the client by S22-01. The backend question is recorded in W22-17.
- **(b) Endings without user action:** no path ends an unknown intent while the screen is open. A
  failed or mismatched Product check keeps it unknown, and the text is read-only. Unmounting and a
  session change end it (S22-05).
- **(c) Conversation keying:**
  - The WO-014 behaviour (entering the open conversation again with another Product replaces the
    context) is unaffected: the Buyer stack reuses the screen for the same conversation
    (`dangerouslySingular`), so the key does not change. Test L-3 passes.
  - The session-owner redirect still runs first on a session change.
- **(d) A 401 `SESSION_EXPIRED` counts as refused:** correct. Authentication fails before the
  handler, the session ends, and nothing is retried (test 23).

## Verdict per focus area (after fixes)

| Area | Verdict |
|---|---|
| Idempotency | OK on the client: one key per payload, the same key on retry; backend replay semantics UNVERIFIED |
| Duplicate-message prevention | OK after S22-01; residual Info S22-03, S22-05 |
| Session-bound requests | OK |
| Product-anchor authorization | OK on the client (re-read, same Seller, same id); server rule UNVERIFIED |
| Seller context | OK: header, composer line and `X-Adulis-Seller` from the active store row |
| Buyer/Seller role isolation | OK: separate calls; the Buyer sends no store header; no key reused across roles |
| Seller A/B isolation | OK |
| Stale responses | OK |
| Permission denial | OK |
| Conversation membership | Server-decided (S21-05 open) |
| Sensitive data exposure | OK: no Buyer id parsed; errors carry kind, status and code only |
| Private cache persistence | OK: no persister; intents in refs; cache cleared at session end |
| Route parameter validation | OK |
| Untrusted message text | OK: plain text, catalogue-only bot copy. Long unbroken strings have no line limit (device wrapping unverified). Stacked combining marks unverified. Store-name bidi is S22-04 |
| Accessibility privacy | OK: announcements are status sentences, never message text |
| Error-message accuracy | OK after S22-01 |

## Text content: actual risk, no sanitisation added

- **Bidirectional controls in a message body** reorder text only inside that body's own text element.
  The sender label, times and anchors are separate elements and cannot be spoofed by a body.
- **Spoofing characters** (look-alike letters, zero-width characters) can make a body read
  misleadingly. That is a moderation question, outside this work order. Nothing was censored or
  transformed.
- **Extremely long unbroken strings** render whole with no line limit inside a bubble capped at 88%
  of the width (Jest). Native wrapping is in the backlog.
