# WO-014 -- Founder Handoff

Product-context messaging. 12 November 2026.

## Result

**Buyers can ask a Seller about a specific Product.**

- Product Detail has **Ask Seller About This Product**, also when the Product is unavailable.
- It opens the Buyer's one conversation with that Seller. A second Product of the same Seller
  goes to the same conversation; each message keeps its own Product.
- The composer shows "Asking about", the Product's current name and availability, and
  Remove Product. The Product describes the next message only.
- Before sending, the app reads the Product again. If it was unpublished, belongs to another
  Seller, or cannot be checked, nothing is sent and the Buyer is told why. A lost connection is
  never reported as "removed".
- A guest is sent to sign in, comes back to the same Product, and nothing is opened or sent until
  they tap Ask Seller again.
- A send with no answer cannot turn into a second, different message: its text and Product are
  locked until it is confirmed or the Buyer chooses "Edit the message instead".
- Another Account on the same phone sees none of the first Account's messages or drafts.
- There is no cart, checkout, payment or order path.

**Message history shows "About a Product", not the Product's name.** No read returns a Product
by id, and the work order forbids a new endpoint (ON-20261111-163).

**iOS was not tested.**

## Branch and commits

`mobile/wo-014-product-context-messaging`, from `706e8948f589d56a57c5900390f0ddb040418d95` (the
WO-013 checkpoint). The pushed HEAD is in the final report.

| Commit | Change |
|---|---|
| `32e9f6a` | locale: Product-context messaging strings (packages/locale, own commit) |
| `2d00d4f` | mobile: Ask Seller About This Product on Product Detail |
| `a2e5a18` | mobile: Product-anchored messages in the composer (with the unconfirmed-send lock) |
| `518b88a` | test: the section 19 matrix (21 cases) |
| `a4c7229` | mobile: security-review fixes (M-1, L-2, L-3) with regression tests |
| `2997695` | test: Maestro product-context-messaging.yaml |
| next | docs: the three WO-014 records, the chat gaps update, the guide, the register |

## Tests

- **Jest:** chat.test.tsx 43/43 (WO-013's 19, WO-014's 21, the review's 3); mobile 376/376 (22 suites).
- **Native (Android 17 emulator, real local API, disposable database):** journeys A (Shop to a
  sent Product question), B (two Products, one conversation), C (guest sign-in and return), D
  (Product unpublished between display and send: refused, then sent without it), E (another
  Account), offline (could not be checked, then sent after Try again), Dark at font scale 1.3
  with the keyboard open: all PASS, with the stored rows checked after each step. The first D run
  failed on a wrong flow assertion; it was corrected and D passed (ON-20261111-166).
- **Regressions:** 17 flows plus Seller Profile messaging: all PASS.
- **ON-20261111-159 fixed:** the Dark card check runs on a fresh disposable Account; it passes
  alone and after Saved Collections. No assertion was weakened.
- **Not run:** the dedicated For You flow (ON-20261111-084).
- **Gates:** all green on freshly rebuilt disposable databases at `2997695`:
  - frozen install;
  - API 983/983 bounded;
  - the parallel `pnpm test` (API 983/983, mobile 376/376) green this time; ON-20261111-126
    stays open, since one green run proves nothing about the interference;
  - api-client test and generate:check (generated client unchanged);
  - mobile typecheck, lint, test, build; repo typecheck, lint, build;
  - verify contract, appendix, docs, deps, mt-keys, error-locale;
  - db check and determinism; all 15 ops gates, console-e2e and boot-smoke;
  - Expo Doctor 20/20.

  The bundle scan's two matches are React Native event-subscription identifiers: there is no
  price, tier or billing copy.

## Security

An independent review found no Critical or High issue. Its one Medium (the list re-requested a
failing page back to back) and two Lows were fixed with regression tests
(`WO-014-CHAT-SECURITY-REVIEW.md`). Three Info notes remain recorded (ON-20261111-162, -168).
The server remains the authority for which Product may be attached.

## Decisions for the founder

1. **Page file and C: (ON-20261111-161).** C: fell from 37.95 GB to 14.8 GB free during the
   native work because the system-managed page file grew to 28.6 GB. Nothing was changed. Decide
   a page-file policy, or reboot before long native batches.
2. **Seller ids in public reads (ON-20261111-162)** and **a Product summary on messages
   (ON-20261111-163):** two small additive backend changes that would let the app compare Sellers
   by id and name the Product in history.
3. Unchanged and still yours: ON-20261111-129, -130, -132, -141, -146, -152, -154, -156, the Chat
   backend gaps (ON-20261111-149), and the payment deferral.

## Morning review

The review launcher and its support files now live in `G:\AdulisDevelopment\tools\review\` (no
temporary folders). The guide (`docs/overnight/MORNING-REVIEW-GUIDE-2026-11-12.md`) points there.
To try WO-014: start the environment, sign in, open a Product of Fixture Weaves (for example the
Woven basket from Shop), and tap Ask Seller About This Product.

## Storage

- **Start (A):** C: 37,951,787,008 bytes free; G: 3,359,931,105,280.
- **Before native (B):** C: 28,615,950,336; G: 3,359,909,085,184.
- **Before cleanup (C, after native, emulator stopped):** C: 19,724,832,768;
  G: 3,358,367,678,464.
- **After cleanup (D):** C: 27,163,701,248; G: 3,358,993,678,336.
- **End (after the gates and prepare):** C: 26,367,430,656; G: 3,358,301,618,176.
- **Net growth:** C: -11.58 GB, all of it the system-managed page file (15.7 GB to 29.0 GB
  allocated; ON-20261111-161). G: -1.63 GB (shared caches, gates output, WO-014 evidence 94 MB).
- **Generated:** WO-014 evidence on G: (Maestro output, logs, scripts); the stable launcher and
  harness in `G:\AdulisDevelopment\tools\review\` (742 KB).
- **Removed:** 92 unused Maestro driver APKs (WO-014 and WO-013 temp folders on G:), with the
  audit's verified cleanup, after a dry run.
- **Recovered:** 627 MB on G:.
- **Protected (untouched):** `G:\Android\`, `G:\w2`, `G:\w2x`, `G:\wo001a`,
  `G:\adulis-claude-scratch-archive`, `G:\w10a`; the page file; Docker volumes.
- **Concerns:** the page file (ON-20261111-161); the audit's JSON cleanup summary under-reports
  (ON-20261111-170).
