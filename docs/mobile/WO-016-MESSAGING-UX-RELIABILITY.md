# WO-016 -- Messaging UX, accessibility and reliability

Work order WO-016 (12 November 2026). Branch `mobile/wo-016-messaging-ux-reliability`, from the
WO-015 checkpoint `67c48bbad70cc4c9f1a7e600bfd4ea88d062975f`. Engineering record. There is no
backend change, no new endpoint and no new error code.

## 1. Sources

- ADU-CHAT-01 v3.3 S10 (no false sent state; connected-only; local draft), S15 (idempotency, error
  codes), S17 (no enumeration); ADU-MOB-02 v4.3 S125-S130; the WO-013 and WO-014 records.
- Issues addressed: ON-20261111-164, ON-20261111-168, and the unconfirmed-send explanation.

## 2. ON-20261111-164 -- the keyboard and the message history

| | |
|---|---|
| **Original bug** | At font scale 1.3 with the keyboard open, the message list had no height left; only the composer showed (WO-014 native `pcm-v2-keyboard.png`). |
| **Reproduction** | Android emulator, font scale 1.3, a conversation, a Product attached, tap the message box. |
| **Root cause** | Two faults. (1) The composer was a fixed column (Ask the Seller, Select Product, the context, the box, alerts, the note, the buttons): as text grew, it took all the space and the list shrank to nothing. (2) Found in this work order (B-008): the keyboard-avoiding view measured the keyboard against its own frame, which starts under the navigation header, so it shrank the screen by less than the keyboard. WO-014 hid this, because only the small note at the bottom was under the keyboard. |
| **Exact fix** | The history keeps at least 120 dp. The composer's content scrolls inside at most 60% of the screen. Send (or Try sending again, plus Edit the message instead) stays fixed under that scroll area, never inside it. The keyboard-avoiding view's vertical offset is the header's height. Nothing was hidden or made smaller. |
| **Regression test** | Jest "ON-164. the composer scrolls inside its own area; Send stays outside it" (structure). Native `messaging-layout.yaml` (below). |
| **Native verification** | The first run with only the layout change FAILED at all three font scales: Send was under the keyboard (B-008). After the offset fix, all PASS: a conversation with 30 history messages (one long), a Product attached, the keyboard open, with the newest message, the context and Send all on screen, at 1.0 Light, 1.3 Dark and 1.6 Light. Then the Product removed with the history still visible. |

## 3. ON-20261111-168 -- the ambiguous 404

| | |
|---|---|
| **Original bug** | A 404 on an anchored send always said "This Product is no longer available to ask about", though the API returns the same NOT_FOUND when the conversation is not available. |
| **Reproduction** | An anchored send answered 404 while the Product still reads as public. |
| **Root cause** | The client turned every NOT_FOUND on an anchored send into "Product gone". |
| **Exact fix** | A 404 on send shows a neutral, privacy-safe line and keeps the text. Anchored: "Your message was not sent. This conversation or the Product with it may not be available right now. Your message is still in the box below." Plain: the same without the Product. The screen then reads the Product again and the messages again. Only a current 404 from those reads says "This Product is no longer available to ask about" or "This conversation is not available". Offline and timeout stay "may already have been received" (unconfirmed), never a refusal. Idempotency is unchanged: a 404 is an answer, so the next attempt is a new intent. |
| **Regression test** | Jest "20, 28. a 404 at send time is not sent and says so neutrally ..." (the Product still readable stays attached); "ON-168. a 404 on an anchored send, then a current read that answers 404: only then is the Product called gone" (with the screen-reader announcement); "ON-168. a 404 on a plain send names no cause; a messages read that answers 404 then shows the conversation as not available". |
| **Native verification** | Not reproducible natively without a server fault injection (the server does not refuse an eligible Product); covered by the Jest cases against the in-memory server's rules. |

## 4. Unconfirmed sends

When a send gets no answer (offline, timeout), the message may have been stored:

- the composer says: "Your message may already have been received. Trying again checks the same
  message, so it is not sent twice. Editing it makes a new message, which could arrive twice.";
- the main button reads **Try sending again**. It sends the same text, Product and idempotency key,
  so a message the server already stored is answered as already stored, never duplicated;
- **Edit the message instead** gives the attempt up explicitly. It is ignored while a send is in
  flight (security review L2);
- the text, Remove Product and Select Product are locked until one of the two is chosen;
- it is never shown as "not sent" (a confirmed refusal), and never as sent until the server
  confirms.

Native: a message sent with the API stopped showed the explanation with both buttons. After the API
came back, Try sending again stored it **once** (database: 0 copies while offline, 1 after).

## 5. Conversation usability (narrow)

- **Announcements:** "Sending your message", the unconfirmed explanation, "not sent", and the
  neutral refusals are announced, because the alert role alone is not spoken on Android. Every
  announcement is a fixed sentence; none reads out the message or a Product name.
- **Long messages:** bubbles wrap within 88% of the width (checked with a 12-sentence message,
  native).
- **Composer:** it scrolls on small screens and with enlarged text. Send never scrolls away.
- **Unchanged and kept:** sender attribution, timestamps (the locale's medium date and short time),
  Load earlier messages, Refresh, and the 30-second foreground refresh (no new polling). Nothing
  was invented: no read receipts, typing, presence, unread counts or response-time promises.

## 6. Reliability (section 20)

| # | Case | Covered by |
|---|---|---|
| 1 | Sign-out during a message send | Jest "20.1. signing out while a message is sending ..." |
| 2 | Account switching while Product selection is open | Jest WO-015 "20, 21" |
| 3 | Delayed Seller Product response | Jest "20.3, 20.5" (slow list cancelled) |
| 4 | Conversation no longer accessible | Jest "ON-168 ... plain send" (then "not available"); WO-013 "18, 23" |
| 5 | Seller storefront unavailable | Jest "20.3, 20.5" (the list 404: error and Try again, nothing attached) |
| 6 | Product unpublished | Jest WO-014 "20", WO-015 "13"; native WO-014 Journey D |
| 7 | Network timeout | Jest "20.7. a send that times out is unconfirmed (not failed), and keeps its key" |
| 8 | Duplicate Send taps | Jest WO-013 "11", WO-014 "25" |
| 9 | Retry after an uncertain send | Jest "18. ..." (same key and body); native `lay-offline` and `lay-retry` (one copy) |
| 10 | Explicit abandonment | Jest WO-014 "27", WO-015 "19" |
| 11 | Re-entering the same conversation | Jest WO-014 "review L-3" |
| 12 | Switching between conversations | Jest WO-014 "17" |
| 13 | Returning from Product Detail | Jest WO-014 "9" (two Products, back and forth); native WO-014 B |
| 14 | Pagination boundaries | Jest WO-013 "7" (messages), WO-015 "6" (picker), B-002 (list walk) |
| 15 | No private state across Accounts | Jest WO-013 "21", WO-015 "20, 21", "20.1" |

## 7. Tests

- Jest: chat.test.tsx 67/67; the full mobile suite 400/400 (22 suites).
- Existing tests were updated, not weakened. Unconfirmed retries now press "Try sending again".
  The WO-014 "20, 28" case now asserts the neutral refusal and that the still-public Product stays
  attached (ON-168).
- The fake API's hanging request rejects on abort, as a real `fetch` does. That lets the client's
  10 s timeout be tested.

## 8. Native Android

Android 17 emulator, the WO-010A debug APK, Metro restarted, the real local API on the disposable
database, a new disposable Account, harness step `layout` (`G:\AdulisDevelopment\tools\review\wo014-native.sh`),
flow `apps/mobile/.maestro/messaging-layout.yaml`. Evidence: `G:\AdulisDevelopment\WO-016\maestro\`
and `G:\AdulisDevelopment\WO-016\logs\native-layout*.out`.

| Run | Result |
|---|---|
| First (layout change only) | `lay-view-1.0-light`, `lay-view-1.3-dark`, `lay-view-1.6-light` FAIL (Send under the keyboard, B-008); `lay-open`, `lay-offline`, `lay-retry` PASS (0 copies offline, 1 after) |
| After the offset fix | all PASS: views at 1.0 Light, 1.3 Dark, 1.6 Light; open; offline; retry (0 then 1 copy) |

Not run natively: the sending state (too brief to capture), a server-side 404 (needs fault
injection), and the security-review fixes (L1 announcement, L2 guard), which change no layout and
are covered by Jest.
