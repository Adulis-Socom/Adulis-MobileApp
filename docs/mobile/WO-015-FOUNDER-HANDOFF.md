# WO-015 -- Founder Handoff

In-conversation Product selector. 12 November 2026.

## Result

**A Buyer can attach a Product from inside a conversation.**

- Each conversation's composer has **Select Product**. It opens a list of that Seller's public
  Products (photo, name, availability) that loads more as you scroll.
- Choosing one attaches it to the next message only. Nothing is sent, the text you typed stays,
  and no new conversation is created. You can choose another or remove it.
- Sending puts the Product on that message. Two messages about two Products of the same Seller
  stay in the same conversation, each with its own Product (checked natively in the database).
- The app uses the same Product check as Ask Seller from Product Detail (WO-014). It reads the
  Product, confirms it belongs to this conversation's Seller, reads it again before sending, and
  the server has the final say.
- While a message's outcome is unconfirmed, the Product cannot be changed.

**Limitation:** the app finds a conversation's Seller in the Buyer's 100 most recent conversations
(four pages of the list), because the API publishes no Seller id. For an older conversation,
Product selection is off, with an explanation, and plain messages still work (ON-20261111-162).

**iOS was not tested.**

## Branch and commits

`mobile/wo-015-conversation-product-selector`, from `c8efdb8424ddda79505a5eb597ecc33944b76c2c`
(the WO-014 checkpoint). Checkpoint HEAD: see the batch handoff
(`docs/overnight/WO-015-017-CONSOLIDATED-HANDOFF.md`).

| Commit | Change |
|---|---|
| `c6a351c` | locale: selector strings (packages/locale, own commit) |
| `b052307` | mobile: Select Product, the picker, the bounded list walk (fixes B-002) |
| `44e0950` | test: the section 13 matrix (15 cases) |
| `2eda40c` | mobile: the picker inside the safe area (B-005); Maestro selector flow |
| `f7ab805` | mobile: security-review hardening (I-2, I-3, I-4) with tests |
| next | docs: the WO-015 records, the issues file, the chat gaps row |

## Tests

- **Jest:** chat.test.tsx 60/60; mobile 393/393 (22 suites).
- **Native (Android 17 emulator, real local API, disposable database):** Messages -> conversation
  -> Select Product -> Coffee tray -> sent; then Woven basket -> sent. Stored anchors: coffee-tray,
  woven-basket, in one conversation. The picker in Dark at font scale 1.3. All PASS after the
  fixes below.

## Bugs found (details in `docs/overnight/WO-015-017-ISSUES-AND-BLOCKERS.md`)

- **B-002 (fixed):** finding the conversation's Seller stalled after the second page of the list.
  This existed since WO-014.
- **B-004 (fixed):** the review launcher's `prepare` had lost a fixture helper and still said
  "ready". My WO-014 report wrongly called it verified. It now stops on a fixture failure.
- **B-005 (fixed):** the picker's title sat under the status bar.
- **B-007 (fixed):** the launcher could hang waiting for Metro.
- **B-003 (open):** C: fell below the 10 GB gate while the emulator ran and another program held
  about 10 GB of memory.
- **B-006 (fixed):** the shared Metro cache folder was incomplete.

## Security

An independent read-only review of `c8efdb8..2eda40c` found **no Critical, High or Medium
issue**. Its checks:
- the Seller handle comes only from the authenticated conversation list;
- the handle is never used as an id;
- a foreign Product is refused;
- the payload stays frozen while a send is unconfirmed;
- sign-out drops everything;
- the list walk is bounded;
- guests never reach the picker;
- no logging.

Three Info notes were fixed in `f7ab805`, with tests (S-002). One Low (S-001) is recorded as a
backend contract gap: a handle is unique only within a Market, and the API publishes no Seller id
or Market on a conversation. No wrong anchor can be stored, because the server checks every
Product. The review did not cover the server's own enforcement.

## Decisions for the founder

- The page-file and heavy-program issue during native testing (B-003, ON-20261111-161).
- A Seller id on the conversation list (ON-20261111-162) would remove the 100-conversation limit.

## Storage (bytes free)

| Point | C: | G: |
|---|---|---|
| Before development | 26,604,363,776 | 3,358,291,132,416 |
| After development (before native) | 26,583,678,976 | -- |
| During native (blocked) | 9,913,442,304 | 3,358,156,914,688 |
| After testing (emulator stopped) | 38,178,361,344 | 3,357,915,742,208 |
| After cleanup | 38,214,889,472 | 3,358,037,377,024 |

- **Generated:** WO-015 Maestro evidence and logs on G:.
- **Removed:** 22 unused Maestro driver APKs from the WO-015 SSD temp folder, dry run first.
- **Recovered:** 122,683,392 bytes on G:.
- **Protected:** untouched.
- C: rose overall because the page file shrank from 29.4 GB to 18.6 GB once memory pressure
  eased, not because of cleanup.
