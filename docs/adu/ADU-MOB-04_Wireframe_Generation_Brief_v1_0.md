# ADU-MOB-04 -- Buyer Mode: Wireframe Generation Brief

**Version:** 1.0  -  **Baseline date:** 5 September 2026
**Owner:** Founder / CEO -- sole engineer (ADU-REPO-01 v1.3 S3)
**Status:** **Operating brief.** It produces wireframes, and it is **also the test that ADU-MOB-02 and ADU-MOB-03 are complete.** It is binding on nothing; the two documents it draws from decide.
**Scope:** Buyer Mode, all forty screens.
**Drawn from:** ADU-MOB-02 **v1.0** (screens, regions, states, copy)  -  ADU-MOB-03 **v1.0** (components, tokens, layout)  -  ADU-MOB-01 v1.1  -  ADU-MOB-00 v1.1  -  ADU-PROJ-01 v9.0 S12
**Produces:** wireframes, and **ADU-MOB-04-R1**, the rulings register that comes out of drawing them.
**Encoding:** ASCII.

---

## 0. What this is

**ADU-MOB-02 says what a buyer sees. ADU-MOB-03 says what it is made of. Neither has been looked at.**

This document turns those two into prompts -- one per screen, forty of them -- and grades what comes back. **It is deliberately mechanical**: every brief below is a transcription of an `MB-nn` entry plus the components that render it, and where a brief has to make a decision the two source documents did not, **that is a defect in them and S8 says what to do about it.**

### 0.1 The real purpose, stated first

> **The console's wireframe rounds found two defects in ADU-CON-03 v1.0** -- a region drawn without its precondition, and *"per-category toggles"* for categories no document had ever enumerated. **Both were found by drawing the screens, which is what drawing them was for.**
>
> **Expect the same here.** A specification survives reading and fails drawing, because reading skips the thing that is not there and drawing cannot. **The output of this brief is therefore two things: pictures, and a list of the places the documents ran out.**

### 0.2 What a wireframe is here

**Grey-box layout at device size.** Regions, hierarchy, control placement, and **real strings at real lengths.** Not colour, not brand, not imagery, not typography beyond the scale's relative sizes, not final copy.

**It is not a mockup and it is not a prototype.** Nobody signs off a visual design from this, and nothing is built from it (W6).

### 0.3 The rulings in this document

| # | Ruling |
|---|---|
| **W1** | **Grey-box only.** No colour, no brand hue, no photography. `brand.base` is unruled (ADU-MOB-03 Q1) and a coloured wireframe gets reviewed for its colour |
| **W2** | **Every screen is drawn in all of its ADU-MOB-02 states, not only `READY`.** The states are the deliverable |
| **W3** | **Real sentences at English + 45%**, never lorem ipsum -- and a named subset drawn in **actual Amharic at the largest OS text size** |
| **W4** | **One screen per prompt.** Never "generate the app" |
| **W5** | **A defect found by drawing is fixed in ADU-MOB-02 or ADU-MOB-03 first, and the drawing is regenerated. The drawing is never patched** |
| **W6** | **No wireframe is a source of truth.** Where a build and a wireframe disagree, the content and design documents decide, and the wireframe is stale |
| **W7** | **The must-not list travels with every single prompt.** This is the most important ruling here, and S2 says why |
| **W8** | **Wireframes are not committed under `apps/mobile`.** They live beside the documents and are versioned with them |

---

## 1. The generation contract

### 1.1 Frames

| | |
|---|---|
| **Primary frame** | **360 x 800 dp** -- the low-end Android of ADU-PRD-01 S23, which is the binding constraint and not the developer's phone |
| **Secondary frame** | 393 x 852 pt -- a current iPhone, drawn **only** for the eight screens in S5 |
| **Safe areas** | Drawn as visible guides. **Status bar 24dp, gesture bar 16dp.** Nothing interactive inside either (ADU-MOB-03 D11) |
| **Not drawn** | Tablet. Landscape. Foldables. **The app is portrait phone only at MVP**, and drawing a tablet invites a tablet layout nobody agreed to build |

### 1.2 Strings

> **RULING W3 -- real sentences, at length, in both directions.**

- **English strings are the content intent from ADU-MOB-02**, written out as full sentences. **Never lorem ipsum** -- lorem is the wrong length, the wrong shape, and it hides exactly the overflow the drawing exists to expose.
- **Every string is then drawn again at +45%**, which is the Amharic expansion band (30-50%) taken at its upper end. **A layout that only works at 100% is a layout that fails in Amharic**, and the drawing is where that costs nothing to find.
- **Long-name test data, not friendly test data.** Seller names, product names and handoff notes are drawn at plausible maximum, not at "Selam's Shop".
- **A named subset is drawn in real Amharic at the largest OS text size** (S6, round 3). Real Ge'ez, not transliteration -- the point is glyph height and line box, which transliteration does not test.

### 1.3 Components

**Every region names its component from ADU-MOB-03 S3.** A drawing that invents a control has found a gap in that inventory -- **which is a finding, not a licence** (W5).

**Type sizes are drawn at their relative scale** -- `display` > `title` > `heading` > `body` = `bodyStrong` > `caption` -- and `mono` is drawn as monospace, because the account number's tabular alignment is a design decision that has to be visible.

### 1.4 Annotation

Each drawing carries, in the margin:

- the **`MB-nn` id** and the state being drawn;
- the **endpoint(s)** the screen calls;
- **every invariant string quoted verbatim** from ADU-MOB-02, marked as invariant;
- the **must-not items** that apply to this screen (S2, S4).

**A drawing without its annotation is not reviewable**, because half of what is being checked is whether something is correctly absent.

---

## 2. The must-not list, and why it travels with every prompt

> **RULING W7 -- every prompt carries the must-not list. Not a link to it. The list.**

**Any generator that can draw a shopping app has been trained on shopping apps**, and Adulis is not one. It will draw, unprompted and confidently:

| It will draw | Because every other app has it | Forbidden by |
|---|---|---|
| **A global search bar in the header** | Every marketplace has one | There is no cross-seller search. ADU-MOB-02 S2.2 |
| **"Recommended for you", "Trending", "Similar items"** | Every feed has them | `GET /v1/feed` accepts no ranking parameter, and none may be added |
| **A star rating averaged into one number** | Universal | **Two ratings, always separate, never averaged.** `RatingPair` has no single-number variant |
| **"Buy now" / "Checkout" / a card payment selector** | Every cart | **Nothing is bought on Adulis.** Payment goes directly to the seller, off-platform |
| **A price filter, a sort-by control** | Every catalogue | The seller's display order is the default; search narrows, never re-ranks |
| **A promo code field** | Every checkout | It does not exist |
| **A wishlist / save-for-later / heart icon** | Every product page | It does not exist |
| **"Sign in to continue" at launch or on browse** | Every app with accounts | **Identity is created at first reserve and nowhere else** |
| **A tier badge, an upgrade banner, a price for anything but a product** | Freemium apps | **ADU-MOB-02 M2.** This is the App Store rejection, drawn |
| **"Sell on Adulis"** | Every marketplace | B19 |
| **A verified tick beside a payment or a seller** | Every trust surface | **Adulis never asserts a payment is genuine and never characterises a seller** |
| **A delivery ETA or tracking map** | Every commerce app | Adulis does not deliver |
| **Scan and "I received it" as two equal buttons** | Reasonable-looking | **ADU-MOB-02 M6.** The single most damaging thing this brief could produce |
| **A success tick the moment the scan decodes** | Every scanner | The outcome comes from the server. `SENDING` is not success |
| **A bare spinner on a blank screen** | Every loading state | Skeletons, matching the final layout (ADU-MOB-03 P5) |
| **A toast for an error the buyer must fix** | Common | ADU-MOB-03 D9 |
| **An empty state that is an icon and an apology** | Common | Three parts, always (ADU-MOB-03 R4) |
| **Sign out and Delete account adjacent** | Every settings screen | ADU-MOB-02 M11 |

> **This table is the grading sheet.** A drawing containing any row above is regenerated, and **if the prompt did not carry the row, the prompt was wrong** rather than the generator.

---

## 3. The standing preamble

**Paste this at the top of every prompt, unchanged, before the screen brief.**

```text
You are producing a GREY-BOX WIREFRAME for one screen of a mobile app.
Frame: 360 x 800 dp, portrait, Android. Draw the status bar and gesture-bar
safe areas as guides; nothing interactive inside them.

OUTPUT RULES
- Greyscale only. No colour, no brand, no logos, no photographs. Images are
  crossed boxes at their real aspect ratio.
- Boxes, labels and real text. Never lorem ipsum. Use the strings given.
- Relative type sizes only: display > title > heading > body > caption.
  Monospace where the brief says monospace.
- Minimum touch target 44 x 44 dp, minimum 8 dp between adjacent targets.
- The primary action sits in the bottom third and is pinned, not at the end
  of a scroll.
- No fixed-height container around text. Text may wrap; it must never clip
  and must never be truncated with an ellipsis.
- Draw EVERY state the brief lists, as separate frames, labelled.

THIS APP IS NOT A MARKETPLACE. Do not add any of the following, even if it
seems obviously missing:
  global or cross-seller search - recommendations, trending, "similar items"
  - a single averaged star rating - "Buy now", checkout, or any card or
  wallet payment control - price filters or sort controls - promo codes -
  wishlist or save-for-later - a sign-in prompt at launch or while browsing
  - subscription prices, tier names, upgrade prompts, or any billing link -
  "sell on Adulis" - verified ticks on payments or sellers - delivery
  estimates, couriers or tracking - a wallet or balance.

Add nothing that is not in the brief. If something seems missing, LIST IT
IN A NOTE INSTEAD OF DRAWING IT.
```

> **The last sentence is the one that earns this document.** A generator's instinct to fill a gap is exactly what must be captured rather than satisfied -- **a note saying "there is no way to X here" is the finding this whole exercise exists to produce** (S8).

---

## 4. The forty briefs

**Each row: what the screen is for, its regions in reading order, the states to draw, and the trap specific to it.** Regions are ADU-MOB-02's; component names are ADU-MOB-03's.

### 4.1 Group A -- Entry and recovery

| Screen | Regions, in order | States to draw | The trap |
|---|---|---|---|
| **MB-00** First launch | wordmark - one sentence on what Adulis is - **Paste a post link** - **Find a seller** - language control | `LOADING`, `READY`, `TRANSPORT_ERROR` | **It will draw a sign-in.** There is none. Also: bootstrap failure is a full screen, not a toast |
| **MB-01** Home | *Life 1:* the two recovery actions, equally weighted, plus one sentence  -  *Life 2:* feed rows (`C1` list density) | Life 1, Life 2 `READY`, `STALE`, `TRANSPORT_ERROR` | **Life 1 is not an empty state.** It will draw suggested sellers, categories or a search bar. None exist |
| **MB-02** Paste a post link | paste field - explicit paste control - results | `READY`, `SENDING`, **all five result cases**, `VALIDATION` | **It will draw only the single-match case.** *Several matches* is the ordinary outcome and needs the most space |
| **MB-03** Find a seller | search field - results (`C6`) | `READY`, `SENDING`, `EMPTY` | It will add *recent searches* and *popular sellers*. Neither exists |
| **MB-04** Sign in | phone with prefix - request - code entry - **age checkbox** - resend countdown - change number - help | `READY`, `SENDING`, `VALIDATION`, `CONFLICT` (rate limited, superseded) | **The checkbox renders for everyone**, always. It will add a password, "continue with Google", or show the checkbox only on a "create account" path |
| **MB-05** Upgrade required | one sentence - store control | `READY` only | It will add "Later", "Remind me", or a close affordance. **Nothing routes past this screen** |

### 4.2 Group B -- Discovery

| Screen | Regions, in order | States to draw | The trap |
|---|---|---|---|
| **MB-06** Storefront | header: logo, name, handle, **level + completed handoff count** - follow (`C7`) - fulfilment note - availability/closure - search + filter row - grid (`C1` grid) - reviews entry | `LOADING`, `READY`, `STALE`, `EMPTY`, `NOT_FOUND` | It will add a sort control and a global search. **Filters narrow; nothing re-ranks.** The counts are counts, not praise |
| **MB-07** Product | media carousel + video poster - name - `C2` - variant selector - `C3` **with `confirmed_at`** - description - attributes - `C6` - fulfilment note - **Add to cart** - reviews summary - report | `LOADING`, `READY`, `NOT_FOUND` | **"Buy now". A heart. Related products. An averaged star.** All four are reflexes. Also: the screen must be complete with the video never tapped |
| **MB-08** Video embed | one line naming the platform, **before** load - the embed area | `LOADING`, `READY`, `TRANSPORT_ERROR` | It will draw autoplay and platform chrome. The load is on tap, and failure leaves the product screen unaffected |
| **MB-09** Search in a seller | field **naming the seller in its own label** - results | `READY`, `SENDING`, `EMPTY` | The empty state offers this store's full list, **never another seller** |
| **MB-10** Reviews | list: `C5` pair, badge, date, text - one line explaining the badge | `LOADING`, `EMPTY`, `READY` | **One averaged number, and a seller reply.** Neither exists. The empty state explains the gate and offers no action |

### 4.3 Group C -- Cart and reserve

| Screen | Regions, in order | States to draw | The trap |
|---|---|---|---|
| **MB-11** Cart | lines (`C4`, each with **`available_checked_at`**) - total - continue | `LOADING`, `EMPTY`, `READY`, `STALE`, `CONFLICT` (second seller) | It will drop the freshness stamps and add a promo field. **The seller-conflict state offers a new cart, never a merge** |
| **MB-12** Review and reserve | lines - fulfilment + note - total - **[!] fee line, unruled** - sign-in inline - **Reserve** | `READY`, `SENDING`, `VALIDATION` | **A card/wallet payment selector.** There is none -- payment is off-platform and comes later, on MB-17. Draw the fee line as an annotated gap, not a number |
| **MB-13** Reconciliation | header - `O6` rendering **all six** per-line cases | `CONFLICT` only | **It will draw one item and an "update cart" button that fixes it silently.** Every item renders; the buyer chooses; nothing is auto-corrected |
| **MB-14** New-seller disclosure | **full screen** - two facts - continue (bottom third) - back to cart | one state | **A banner or a checkbox.** M7 is a shape ruling. No adjectives, no "don't show again" |

### 4.4 Group D -- Orders and payment

| Screen | Regions, in order | States to draw | The trap |
|---|---|---|---|
| **MB-15** Orders | rows: seller, `O2`, **`O3` labelled**, line count, total, one action | `LOADING`, `EMPTY`, `READY`, `SIGNED_OUT` | An unlabelled countdown on every row, including confirmed ones |
| **MB-16** Order | `O2` + clock slot - `C6` - lines (`C4`) - **`O4`** - `O5` | **All nine action-region variants** in the M4 table, plus `TERMINAL`, `CONFLICT` | **Tabs.** And a countdown at `PAYMENT_CONFIRMED` -- the clock slot is empty there, and what fills it is an annotated gap (Q5) |
| **MB-17** Payment instructions | bank/wallet - account name - **`R3` account number** - amount - reference - one line on directness - **I have paid** | `LOADING`, `READY`, `NOT_FOUND` | **Auto-copy on open. A "pay with card" control. A screenshot warning.** All three are wrong; the number is disclosed *to* the buyer |
| **MB-18** Send proof | pick/take - preview - one line on the reference being readable - send + real progress | `READY`, `SENDING`, `VALIDATION` | **An "evidence verified" tick, or the evidence rendered back later.** The buyer never sees evidence rendered in this app |
| **MB-19** Cancel an item | which line - **the penalty, before the tap** - confirm | `READY`, `SENDING`, `CONFLICT` | It will cancel the whole order. **Per line, always** |
| **MB-20** Refund | what the seller says was refunded - **I received this refund** - route to a claim | `READY`, `SENDING` | It will infer acknowledgement from time passing |

### 4.5 Group E -- Handoff

| Screen | Regions, in order | States to draw | The trap |
|---|---|---|---|
| **MB-21** Scan | viewfinder (`R1`) - the order named - one instruction at `display` - **`Complete without scanning` as a quiet text control below the frame** | **All four `R1` states**, plus `DEVICE_PERMISSION_NEEDED`. **Draw `RETRYING` twice: before 20s and after** | **Two equal buttons.** See S5.6. This is the drawing that matters most in the whole set |
| **MB-22** Scan outcome | `O2` from the server - what happened - next action | **All six outcomes, plus the default branch** | `REJECTED_REPLAY` drawn as an error. It is drawn as **complete** |
| **MB-23** Complete without scanning | sheet - the two-step copy - confirm | `READY`, `SENDING` | It will read as discouraging. **Neutral: this buyer is doing the honest thing** |

### 4.6 Group F -- After the handoff

| Screen | Regions, in order | States to draw | The trap |
|---|---|---|---|
| **MB-24** Leave a review | **`C5` write variant -- two ratings** - free text - the line saying it always publishes - submit | `READY`, `SENDING`, `CONFLICT` | One star row. **Two, separate, always** |
| **MB-25** Claims | list - `O2` per claim | `LOADING`, `EMPTY`, `READY` | **The empty state will get a "file a claim" button.** It gets none -- an empty claims list is good news |
| **MB-26** Claim | what happened - **read-only** evidence - remedies - deadline - `O5` | `READY`, `TERMINAL` | Editable evidence, and a second claim rather than one gaining evidence |
| **MB-27** Claim evidence | **`R2` interstitial carrying the single-transaction rule** - picker - preview - submit | interstitial, `READY`, `SENDING` | **"Upload your bank statement."** The screen exists to prevent exactly that |
| **MB-28** Report | sheet - reason list - submit | `READY`, `SENDING` | It will exist on one surface. **Draw its entry point on product, storefront, review, message and seller** |
| **MB-29** Block | sheet - consequence, including any open order - confirm | `READY`, `SENDING` | Merged into report. They are two controls |

### 4.7 Group G -- Chat

| Screen | Regions, in order | States to draw | The trap |
|---|---|---|---|
| **MB-30** Conversations | rows: seller, preview (**the one place truncation is the design**), unread dot, linked object | `LOADING`, `EMPTY`, `READY`, `SIGNED_OUT` | An unread **number**. A dot, because a number from a stale read is a lie |
| **MB-31** Conversation | thread with the anchor pinned - **bot messages visibly marked** - `H4` chip row - composer - escalate | `LOADING`, `READY`, `SENDING` | **Suggested replies and a generative composer.** The bot is deterministic; a suggestion feature is the rejected LLM arriving sideways |

### 4.8 Group H -- Account

| Screen | Regions, in order | States to draw | The trap |
|---|---|---|---|
| **MB-32** Account | *anonymous:* sign in, language, about, help  -  *signed in:* masked phone, Following, Notifications, Devices, Language, About, **Sign out**, ...gap..., **Delete my account** | both variants | **Delete directly under Sign out.** Draw the separation and measure it |
| **MB-33** Notifications | chronological, unread marked, each deep-linking | `LOADING`, `EMPTY`, `READY` | -- |
| **MB-34** Notification primer | one sentence with the reason - then the OS prompt | one state, **annotated "after first reservation, never at launch"** | It will place this at launch |
| **MB-35** Following | followed sellers, unfollow, per-seller preferences | `LOADING`, `EMPTY`, `READY` | A "discover sellers" rail in the empty state |
| **MB-36** Devices and sessions | list with label, last used, approximate location - individual revoke | `LOADING`, `READY` | **A "sign out everywhere" control.** `revoke-others` is CONSOLE-only and does not exist here |
| **MB-37** Delete my account | **explain -> phone -> code -> confirm**, in that order - `O6` blockers, **every one with its clearing action** | each of the four steps, plus `CONFLICT` with **three** blockers | A one-tap delete using the existing session, and a blocker list showing only the first |
| **MB-38** Language | English / Amharic | `READY`, **annotated "hidden until `AM_ENABLED`"** | -- |
| **MB-39** About | version, privacy, terms, contact, licences | `READY` | **A pricing link, a "become a seller" invitation, or a sentence about what sellers pay.** The highest copy risk in the app |

---

## 5. The eight drawn in full, and the prompts for them

**These eight are drawn first, on both frames, and reviewed before the other thirty-two are generated.** Each is chosen because drawing it wrong is expensive: it either costs money, costs a store submission, or costs the product its differentiator.

**Each block below is pasted after the S3 preamble, unchanged.**

### 5.1 MB-01 Home, both lives

```text
SCREEN: Home. Draw TWO frames, labelled "Life 1" and "Life 2".

LIFE 1 - the buyer follows nobody. THIS IS THE FIRST SCREEN EVERY BUYER
SEES AND IT IS A DESIGNED SCREEN, NOT AN EMPTY STATE.
Regions, in order:
  1. Wordmark.
  2. One sentence: "Adulis shows you the sellers you choose to follow."
  3. Two equally weighted actions, stacked, in the bottom third:
     "Paste a post link"  and  "Find a seller".
Nothing else. No search field. No categories. No suggested or popular
sellers. No illustration of an empty box.

LIFE 2 - a feed of recent items from followed sellers. Rows are product
cards at list density: crossed image box, product name (draw one wrapping
to two lines), seller handle, relative time.
No sort control. No filter row. No "recommended" or "trending" section.

Tab bar: four tabs - Home, Orders, Chat, Account. No fifth tab.
```

### 5.2 MB-04 Sign in, with the age declaration

```text
SCREEN: Sign in. Draw THREE frames: "phone entry", "code entry",
"rate limited".

PHONE ENTRY: country prefix + phone field; one primary action
"Send me a code"; a help link. NO password field. NO "continue with
Google/Apple/Facebook". NO "create account" tab - there is only one path.

CODE ENTRY:
  1. The number it was sent to, with a "change number" control.
  2. Six-digit code entry.
  3. A CHECKBOX, always present: "I confirm I am 18 or over."
     Annotate: "rendered for every user, always - the client never asks
     first whether this phone has an account."
  4. Resend control with a countdown.
  5. Primary action.
Draw a variant where the checkbox is unticked and an error message sits
AT THE CHECKBOX (not as a toast): "Please confirm you are 18 or over."

RATE LIMITED: the same screen with a message giving a wait time.
Annotate: "this message is byte-identical whether or not the number has
an account."
```

### 5.3 MB-07 Product

```text
SCREEN: Product. One frame, scrolling, drawn full-length.
Regions, in order:
  1. Media carousel: crossed boxes, 4:5. First slide is a video POSTER
     with a play affordance. Annotate: "the video loads only on tap."
  2. Product name - draw it wrapping to THREE lines.
  3. Price.
  4. Variant selector - two attribute rows, one option shown as
     unavailable.
  5. Stock line WITH its freshness stamp: "6 left - seller confirmed
     2 days ago". The stamp is required, at caption size.
  6. Description, three paragraphs.
  7. Product attributes as label/value rows.
  8. Seller strip: logo, name, handle, trust level, completed handoff
     count as a NUMBER, and a Follow control.
  9. Fulfilment note in the seller's words.
 10. Reviews summary: TWO separate ratings, never one averaged star.
 11. A report control.
Pinned in the bottom third: "Add to cart".

DO NOT ADD: "Buy now". A wishlist or heart. A share sheet. Related or
similar products. A single star rating. A delivery estimate. A quantity
stepper beside the buy control (quantity is chosen in the cart).
```

### 5.4 MB-12 and MB-14, reserve and the disclosure

```text
SCREEN: Review and reserve, PLUS the disclosure that precedes it.
Draw THREE frames.

FRAME 1 - "Review and reserve":
  lines with quantity and price; fulfilment method and the seller's note;
  a total; an inline sign-in block for a buyer with no account; pinned
  primary action "Reserve".
  Draw an EMPTY ANNOTATED ROW where a delivery fee would go, labelled
  "[GAP - fee not ruled, ADU-VAL-01 3.8]". Do not invent a number.

FRAME 2 - "New-seller disclosure", FULL SCREEN, drawn as it appears
BEFORE the reserve completes:
  Two facts only:
    "This seller has not completed any handoffs on Adulis yet."
    "Your payment goes directly to the seller. Adulis does not hold,
     forward or refund it."
  One action in the bottom third: "Continue". Plus a back-to-cart link.
  NO checkbox. NO "don't show this again". NO dismiss. NO adjective -
  do not write "risky", "unverified", "be careful" or any warning word.
  The body scrolls; the action stays pinned.

FRAME 3 - the same disclosure with every string at +45% length,
showing that the action is still pinned and nothing clips.
```

### 5.5 MB-16 Order, all nine action regions

```text
SCREEN: Order. Draw NINE frames, one per state, sharing one layout.
Layout, in order: state badge + clock slot; seller strip; line items;
ACTION REGION; history list.

The clock slot differs and this is the point:
  CREATED / NOTIFIED     -> countdown labelled as the BUYER'S deadline:
                            "Pay by 18:40 today to keep your reservation."
                            Action: "View payment instructions"
  Instructions seen      -> same clock. Action: "I have paid - send proof"
  PAYMENT_SUBMITTED      -> countdown labelled as the SELLER'S:
                            "Selam is checking your payment and must
                             answer by 14:20 tomorrow."
                            ACTION REGION IS EMPTY. Draw it empty, with
                            one line saying there is nothing to do.
  Payment rejected       -> no clock. Action: send proof again, with a
                            line saying one more attempt is allowed.
  PAYMENT_CONFIRMED      -> CLOCK SLOT IS EMPTY. No countdown at all.
                            Annotate: "[GAP - fulfilment window not ruled,
                            ADU-VAL-01 3.2]". Action: contact the seller.
  Ready for handoff      -> Action: "Scan to complete"
  HANDED_OFF             -> Action: "Leave a review"
  Refund issued          -> Action: "I received this refund"
  TERMINAL               -> history only, no actions.

DO NOT draw tabs. DO NOT draw a countdown on the confirmed frame.
DO NOT draw a progress stepper across the top - the order is not a wizard.
```

### 5.6 MB-21 Scan -- the one that matters most

```text
SCREEN: Scan. Draw FIVE frames.

FRAME 1 "framing":
  Camera preview filling the frame. A high-contrast square target frame,
  centred. Above it, the order named: "Order 4821 from Selam's Store".
  Below the target, ONE large instruction line: "Scan the code the seller
  shows you."
  BELOW THAT, SMALLER AND QUIETER, a plain text control:
  "I received it without scanning".
  THIS MUST NOT BE A BUTTON. It must not sit beside the scan action as an
  equal. There is no scan BUTTON at all - the camera is the action.

FRAME 2 "sending":
  The preview frozen and dimmed. Large text: "Sending - not yet recorded."
  No tick. No green. No "Success". No checkmark of any kind.

FRAME 3 "retrying, under 20 seconds":
  As frame 2, plus a primary button "Retry now", plus small text showing
  the attempt is continuing. The quiet text control is unchanged.

FRAME 4 "retrying, after 20 seconds":
  As frame 3, but "I received it without scanning" is now a SECONDARY
  BUTTON beside "Retry now", with one line beneath:
  "This records the handoff but does not count toward the seller's level."

FRAME 5 "camera permission refused":
  No preview. What the camera is for, a control to open Settings, and
  "I received it without scanning" still available.

DO NOT draw: a success state, a tick, a torch/flip control as the primary
affordance, a manual code-entry field, or any navigation away from this
screen.
```

### 5.7 MB-17 Payment instructions

```text
SCREEN: Payment instructions. One frame.
Regions, in order:
  1. The amount, large.
  2. Bank or wallet name.
  3. Account name.
  4. ACCOUNT NUMBER in monospace with tabular figures, with a COPY
     control beside it, and the number itself selectable.
  5. The reference the seller expects, same treatment.
  6. One line: "This payment goes directly to the seller."
  7. Pinned: "I have paid - send proof".

Annotate: "nothing is copied to the clipboard automatically."
Annotate: "screenshots are NOT blocked - the buyer needs this number in
their bank app."

DO NOT draw: a "Pay with card" or wallet button, a QR code to pay, a
countdown, a screenshot warning, or an "Adulis has verified this account"
line.
```

### 5.8 MB-27 Claim evidence

```text
SCREEN: Claim evidence. Draw TWO frames.

FRAME 1 - a full-screen interstitial shown before the picker:
  "Upload the record of this one payment."
  "Do not upload a full bank statement. It would show your balance, your
   salary and everyone else you have paid, and none of that is needed to
   prove this transaction."
  One action: "Choose the payment record".

FRAME 2 - picker, preview, submit.

DO NOT draw: "upload your bank statement", a multi-file picker presented
as the default, or any control suggesting more evidence is better.
```

### 5.9 MB-37 Delete my account

```text
SCREEN: Delete my account. Draw FIVE frames in this order.

1 EXPLAIN - what deletion does, server-supplied. One action: "Continue".
2 PHONE - re-enter the phone number. Annotate: "the app re-verifies by
  OTP even though a session exists - a session must never mint a
  deletion ticket."
3 CODE - six-digit entry.
4 CONFIRM - final confirmation naming what will be deleted.
5 BLOCKED - a list of THREE blockers, each with its own clearing action:
  an open order, an unresolved claim, a pending refund. Every blocker is
  shown, not just the first.

DO NOT draw: a one-tap delete, a delete that reuses the existing session
without re-verification, or a blocker list that says "and 2 more".
```

---

## 6. Three rounds, and what each is for

| Round | What is drawn | The question it answers |
|---|---|---|
| **1** | **The eight in S5**, on both frames | **Are ADU-MOB-02 and ADU-MOB-03 complete enough to draw from?** If a brief cannot be written without inventing something, that is the finding, and round 2 does not start until it is fixed |
| **2** | **The remaining thirty-two**, primary frame only, all states | Does every screen have a component for every region, and a state for every outcome? |
| **3** | **A named subset in real Amharic at the largest OS text size**: MB-04, MB-07, MB-12, MB-14, MB-16 (three states), MB-17, MB-21 (all five), MB-27, MB-37 | **Does the layout survive the language the product is for?** This is the only round that tests ADU-MOB-03 D1, D4 and D10, and it is the round that gets skipped |

> **Round 3 is not optional and it is the one under time pressure.** ADU-PROJ-01 S12 makes the mixed-script render a release gate; **drawing it now is the cheap version of that gate**, weeks before there is a build to run it against.

---

## 7. The review checklist, per drawing

**Run against every frame. Any unticked line sends it back.**

- [ ] Every region in the brief is present, **in the order the brief gives**
- [ ] **Nothing is present that the brief did not ask for** -- checked against S2's table, not by impression
- [ ] Every state listed is drawn, as its own labelled frame
- [ ] Every invariant string is verbatim
- [ ] The primary action is in the bottom third and does not move between states
- [ ] No text is truncated with an ellipsis; nothing clips at +45%
- [ ] Every control is at least 44 x 44 dp with 8 dp separation
- [ ] Every list has an empty state, and the empty state has **what, why, and an action or a stated reason for none**
- [ ] No state is shown by shading alone -- every badge carries its name
- [ ] Every component used exists in ADU-MOB-03 S3, **by name**
- [ ] The generator's notes about things it wanted to add have been read and **each one is either dismissed with a reason or logged as a finding**

> **The last line is the highest-value item on this list**, and it is the one that will be skipped because the drawing already looks right.

---

## 8. What happens when drawing finds a defect

> **RULING W5 -- the document is fixed first. The drawing is never patched.**

| What was found | Where it goes |
|---|---|
| A region with no component | **ADU-MOB-03 S3**, as a new component with its variants and states |
| A state some screen needs and the vocabulary lacks | **ADU-MOB-02 S3**, and it is a contract question before it is a design one |
| A screen that cannot be laid out as specified | **ADU-MOB-02**, as a revision to its regions |
| Copy the brief could not supply | **ADU-MOB-02**, as content intent |
| A decision nobody has made | **ADU-MOB-02 S19**, as a numbered gap, **drawn as an annotated empty region** and never invented |
| A binding-document contradiction | **ADU-MOB-01 S22**, as an F-number |

**All of it collects in `ADU-MOB-04-R1`, the rulings register**, which is written after round 2 and reissues ADU-MOB-02 to v1.1 and ADU-MOB-03 to v1.1 in one pass. **That is how the console did it and it worked** -- eight rulings landed in ADU-CON-03 v1.1, two of them closing defects that document had introduced itself.

---

## 9. What this brief already knows it cannot draw

**Five annotated gaps, drawn as empty labelled regions.** They are ADU-MOB-02 S19's list, and **the drawing's job is to make them visible rather than to fill them.**

| Gap | The screen draws |
|---|---|
| **The delivery fee** (Q6) | An empty annotated row in MB-12's total |
| **The fulfilment window** (Q5) | An empty clock slot on MB-16's confirmed frame |
| **The OTP verify body** (N1) | Nothing visible -- **it changes no pixel**, which is why it is easy to leave unresolved and why it is listed here anyway |
| **The QR payload encoding** (Q11) | Nothing visible on MB-21, and that is the trap: **the screen can be drawn and cannot be built** |
| **The client-event allow-list** (F3) | Nothing visible on MB-14 and MB-34 |

> **Three of the five change no pixel.** A wireframe round that ends with everything drawn and nothing blocked would be a wireframe round that has quietly declared these resolved. **They are listed here so that the drawings' completeness is not mistaken for the specification's.**

---

## 10. Open items

| # | Item |
|---|---|
| **Q1** | **What draws these.** A design tool with a generative plugin, an image model, or by hand. **The brief is written to be tool-agnostic on purpose** -- every prompt block is plain text and every output is graded by S7, not by which tool produced it |
| **Q2** | **Where the output lives.** W8 keeps it out of `apps/mobile`; it needs a home beside the documents with the same versioning |
| **Q3** | **Whether round 3 uses machine Amharic.** It should not be blocked on human translation (ADU-MOB-01 S24 Q8) -- **machine Amharic is wrong text of approximately right shape**, which is exactly what a layout test needs and exactly what a release gate does not |

---

*Operating brief, v1.0. Eight rulings, forty screens, three rounds, and one grading table that is really the point of the document. **The wireframes are the smaller half of what this produces.** The larger half is the list of places where a generator had to be told not to draw the obvious thing -- because every one of those is a place where the product's rules run against every instinct a shopping app has, and a builder working from ADU-MOB-02 alone will meet the same instinct with no table to check it against. **The single most damaging drawing this brief could produce is MB-21 with two equal buttons**, which is why S5.6 spends nine lines forbidding a shape that would look entirely reasonable to anyone who had not read ADU-PRD-01 S11.3. Three of the five known gaps change no pixel at all, and they are listed anyway, so that a complete set of drawings is not mistaken for a complete specification. **ADU-MOB-04-R1 comes out of round 2, and it is what reissues the two documents this brief was drawn from.***
