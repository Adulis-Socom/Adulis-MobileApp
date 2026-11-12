# WO-013 -- Founder Handoff

Buyer-Seller conversations and messaging. 12 November 2026.

## Result

**COMPLETE for the work order's criteria, on the supported subset of the Chat design.**
- Buyers can open or create a conversation with an eligible Seller (Message Seller on the Seller
  Profile).
- They see their own conversations, read the messages, and send plain text.
- Every message is attributed: You, Seller, Seller team, or Automated answer.
- Duplicate sends are prevented.
- Ask the Seller escalates.
- Cross-Account isolation holds.
- The Android validation passes.
- There is no payment or checkout path.

**The canonical Chat design is NOT complete** (`WO-013-CHAT-CONTRACT-GAPS.md`, 33 rows, ON-149).
These need backend work:
- Product, Scene and Order subjects;
- read state, unread counts and a waiting status;
- attachments;
- quick replies;
- reporting.

**Automated answers show only a neutral line.** The server sends bot answers as template
resources the app has no copy for, so every keyword answer shows "This automated answer cannot be
shown." followed by Ask the Seller (ON-152). Only the escalation line renders.

**iOS was not tested.**

## Branch and commits

`mobile/wo-013-buyer-messaging`, from `37bfd566112ebde9429c7b6d277eea63a3a9be5a` (the WO-012
checkpoint). The pushed HEAD is in the overnight report.

| Commit | Change |
|---|---|
| `2d7df34` | locale: messaging strings (packages/locale, own commit) |
| `cc2a533` | mobile: Message Seller, Messages, the conversation, sending, Ask the Seller, tests |
| `04afe9a` | locale: the unconfirmed-send sentence |
| `e99baf7` | mobile: security-review fixes |
| `85d3cc3` | test: Maestro messaging.yaml |
| next | docs: the three WO-013 records and the register |

## Tests

- **Jest:** chat.test.tsx 19/19 (the section 34 matrix plus the review fixes); mobile 352/352.
- **Native, messaging (Android 17 emulator, WO-010A APK reused, real local API, disposable
  database).** The fixture Seller is chatbot-entitled, and the harness gave it a disposable intent
  whose answer template has no catalogue copy.
  - A guest's Message Seller goes to sign-in.
  - Signed in: the conversation opens empty. A plain message is sent and shown as "You". The
    Seller's bot escalates it (no intent matched), showing "Automated answer" and the escalation
    line.
  - "Delivery times?" gets an Automated answer (the neutral line) and Ask the Seller, then the
    escalation line.
  - Messages from You lists and reopens the conversation.
  - Dark at font scale 1.3.
  - Message Seller again returns the same conversation (database: 1 conversation).
  - Another Account sees no conversations.
  - Database: BUYER 2, BOT 3, and two escalation notices to the Seller's owner.
- **Native, final regression (all three work orders' code):**
  - PASS: smoke, Buyer shell, category Shop and Search, Search, Shop, Seller Profile, Scene
    Explorer, Product, guest Save (two parts), Collections, offline 1/2, categories in Dark at
    font scale 1.3.
  - `card-saves` dark failed one assertion because it needs an Account with nothing saved, and it
    ran after Collections saved the Woven basket. The order dependency is in the flow; the app
    behaved correctly. The same Dark/large check passed through `categories` dark.
- **Commerce rows unchanged** (carts 0, reservations 5, orders 8).

## Security

The independent review found no Critical, High or Medium. Fixed (`e99baf7`):
- A send with no answer is now "could not confirm", with the same key kept, instead of "not
  sent", which risked duplicates.
- Same-instant answer ordering.
- A malformed send answer drops its key.
- Polling stops on an unavailable conversation.
- Ask the Seller is guarded by a ref.

Recorded as server items: same-instant `sent_at` and the boundary cursor (ON-153); Seller-written
bot answers never shown (ON-152); a Seller owner can chat with their own store (ON-154).

## Decisions for the founder

1. **Bot answer rendering** (ON-152): how keyword and chip answers reach clients (catalogue keys
   per intent, or reviewed localized text).
2. **Chat policy** (ON-156): staff labels and bot branding, Operator messages, blocking, and
   where reporting lives.
3. **Self-conversation** (ON-154): refuse a Seller owner messaging their own store?
4. **Next Chat backend work** (ON-149, ON-155): Product and Scene subjects, read state and
   status, attachments, quick replies.
5. **A Messages tab?** Messages lives under You and on the Seller Profile. No permanent tab was
   added without a navigation decision.

## Storage

| Checkpoint | C: free (bytes) | G: free (bytes) |
|---|---|---|
| A, before development | 19,801,669,632 | 3,361,452,589,056 |
| B, after coding | not taken separately (coding and native testing overlapped) | -- |
| C, after testing | 19,510,648,832 | 3,360,176,472,064 |
| D, after cleanup | 19,537,113,088 | 3,360,676,642,816 |

- **C: steady.** Within 0.3 GB. The page file stayed at 38,816 MB, and Docker's disk was unchanged.
- **Cleanup.** 74 verified Maestro driver APKs were removed (466,987,212 B).
- **Kept as evidence.** Maestro screenshots and logs under `G:\AdulisDevelopment\WO-013\maestro`.
- **Untouched.** Shared caches are reused, not cleaned. The protected folders were not touched.
