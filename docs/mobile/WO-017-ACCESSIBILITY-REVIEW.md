# WO-017 -- Buyer accessibility review

Work order WO-017 (12 November 2026). Branch `mobile/wo-017-buyer-frontend-stabilization`, from the
WO-016 checkpoint `a610a413f9fa9f666d9123678e4fbc4888f826dd`.

**What was and was not tested.**
- A read-only code audit of the Buyer screens by an independent reviewer (findings cite file and
  line).
- Jest tests for the fixes.
- Native runs on the Android emulator with enlarged text (font scale 1.3 and 1.6) and Dark mode
  for the conversation, the picker, notifications, card saves and Product context.
- **No screen reader was run.** TalkBack is not automated in this environment, so announcements
  were verified in Jest (the announcement call), not heard on a device.
- iOS was not tested.

## 1. Screens reviewed

For You; Scene Explorer; Product Detail; Seller Profile (Scenes, Products, Reviews, About); Shop and
categories; Marketplace Search; Saved and Collections (including Add to collection); You (Account,
sessions, sign-out, Delete Account); Notifications; Messages and Conversations (with the Product
picker); Sign in and Verify (reached from these screens).

## 2. Checks performed

| Check | How |
|---|---|
| Touch targets (44 dp minimum) | Code audit of every pressable; the shared `Button` (44 dp) and icon buttons (44 dp with labels) |
| Labels and roles; selected, checked and busy states | Code audit (tabs, toggles, cards, rows, images) |
| Screen-reader announcements of loading, errors and results | Code audit; Jest spies on `announceForAccessibility` |
| Enlarged text, clipping, overflow | Native at font scales 1.3 and 1.6; code audit for fixed heights and truncation |
| Keyboard avoidance | Native (conversation at three font scales); code audit of every keyboard-avoiding view |
| Colour-independent states | Code audit (availability in words, filled or outlined glyphs, borders) |
| Light and Dark | Native screenshots of the changed screens in both |
| Offline, not-found and empty states | Code audit; Jest (offline private list, 404 cases) |

## 3. Problems found and fixed

| ID | Severity | Problem | Fix |
|---|---|---|---|
| A-001 | HIGH | 25 failure and error messages relied on the alert role alone, which Android and iOS do not speak. A failed sign-out was silent while a successful one was announced. | A shared `AlertText` announces its message when it appears or changes; 25 sites plus four screen-level failure headlines use it |
| A-002 | MEDIUM | Private screens showed "Loading" forever when offline; Saved showed a generic internal error | "You are offline..." when the first read waits for a connection |
| A-003 | MEDIUM | Search labels dropped "Sold by", "Scene by" and the trust level; a Scene tile cut the Seller name to one line | Labels carry what the row shows; the line wraps |
| A-004 | MEDIUM | Search "no results" was silent after the announced "Searching" | A polite live region |
| A-005 | MEDIUM | Delete Account, Sign in and Verify had no Android keyboard handling and no header offset | The conversation's fix (B-008): Android 'height' plus the header height |
| B-005 | MEDIUM | The Product picker's title sat under the status bar | Its own safe area (WO-015) |
| B-008 | HIGH | Send under the keyboard in a conversation | The header offset (WO-016) |
| ON-164 | -- | Message history collapsed at 1.3 with the keyboard open | Composer scroll area, history minimum (WO-016) |

## 4. Remaining issues (A-006, LOW, recorded)

> **Update (WO-018, 12 November 2026):** all four groups below are addressed on
> `mobile/wo-018-buyer-accessibility-completion`; see `WO-018-BUYER-ACCESSIBILITY-COMPLETION.md`
> and, for native and TalkBack results, `WO-018-NATIVE-ACCESSIBILITY-VALIDATION.md`. The text below
> is the WO-017 finding as recorded.

- **Busy states by opacity only.** In Add to collection and a Collection's Remove, other controls
  look enabled while a change is in flight and ignore taps. The checkbox has no disabled state to
  announce.
- **Pagination by scrolling only** in the public lists (Shop, Search, Seller tabs, Saved, the
  picker) and For You. Messages, Notifications and a conversation have Load buttons. A screen
  reader can still scroll.
- **Product names cut to two lines** in tiles at large text sizes (screen readers get the full name
  from the label).
- **Focus lost on Seller Profile tab switches and Delete Account steps:** the pressed control is
  unmounted. Delete Account's "Checking"/"Deleting" lines are not live regions.

## 5. Found sound

- Home header icon buttons: 44 dp with labels, icons hidden from the reader. Channel tabs have
  the tab role and a selected state.
- Bottom tabs: catalogue labels; selection shown by shape and colour.
- Card Save: at least 44 dp, a toggle with checked and busy states, a filled or outlined glyph.
- Scene card: one summary stop, availability in words.
- Scene Explorer: radio rows with a checked state; labelled photos; the decorative preview is not
  focusable.
- Product Detail: labelled photos and grouped options. Also sound: categories, filters, Search
  clear, choice groups.
- No fixed text heights and no font shrinking anywhere.
- "Gone" only on a server 404; offline and timeouts are never called "removed".
- Account switching clears every private cache (`clearSession` clears the whole query cache);
  private reads are bound to their session; no module-level private state.
