# ADU-MOB-03 -- Buyer Mode: Design System and Component Inventory

**Version:** 1.0  -  **Baseline date:** 5 September 2026
**Owner:** Founder / CEO -- sole engineer (ADU-REPO-01 v1.3 S3)
**Status:** **Binding design system for the mobile workstream, and the authoring document for `packages/tokens`.** It decides **what things look like and what they are made of.** It decides no screen and no copy.
**Scope:** Buyer Mode. The Seller Companion inherits this system unchanged when ADU-CMP-01 is written.
**Drawn from:** ADU-MOB-02 **v1.0**  -  ADU-MOB-01 **v1.1**  -  ADU-MOB-00 **v1.1**  -  ADU-REPO-01 v1.3  -  ADU-CON-03 v1.3  -  ADU-PRD-01 v8.5 S23  -  ADU-PD-01 v1.0 S14  -  ADU-WEB-01 v1.0  -  ADU-PROJ-01 v9.0 S12
**Encoding:** ASCII.

---

## 0. What this document is

**ADU-MOB-02 said what a buyer sees. This says what it is built from.** Every screen in MB-00 to MB-39 is assembled out of the components in S3, and every component is coloured, spaced and typed out of the tokens in S2.

**It does not contain screens, regions, copy or wireframes.** Those are ADU-MOB-02 and ADU-MOB-04. **Where a component carries a ruling from ADU-MOB-02** -- the scan viewfinder, the countdown, the copy field, the disclosure -- the ruling is restated here as a *component contract* rather than as content, and the content document remains the authority.

### 0.1 This document authors `packages/tokens`, and the console inherits it

ADU-MOB-01 S17.1 already fixed the package's shape:

> **`packages/tokens`** -- platform-neutral values. **The console consumes them through Tailwind; mobile consumes them directly. No component lives there**, because a React web button and a React Native button share values, not code.

**What no document has done is give the values.** ADU-CON-03 refers to the package as though it were authored; there is no ADU-CON-04 and no console design-system document. **So this document is where the numbers are decided, and the console gets them by import.**

> [!] **That has a consequence somebody has to own.** If `apps/console` currently carries hard-coded colours, radii or type sizes, **adopting this file is a reconciliation, not an addition** -- and the mismatch will not show up in CI, because a wrong colour compiles. **S9 F4** records it, and the console's pass is not this workstream's work.

### 0.2 What it deliberately does not contain

**No component library.** No brand guidelines, logo usage or marketing design -- those are the CMO's and ADU-WEB-01's. **No motion showreel.** **No dark theme** -- S7 says why, and says what makes it a token change rather than a refactor when it is reopened.

### 0.3 The rulings in this document

| # | Ruling | S |
|---|---|---|
| **D1** | **`includeFontPadding: false` is banned.** It is the standard React Native recipe for tidy Latin text and **it clips Ge'ez on Android** | 2.3 |
| **D2** | **No component sets an Ethiopic-only font family**, and the default text style is the Latin family. Carried from B16 and enforced by grep | 2.3 |
| **D3** | **Three font weights, both families, and the bundle is measured rather than assumed** | 2.3 |
| **D4** | **There is no height token and no fixed-height container holding text** | 2.4 |
| **D5** | **Every colour is semantic. No component names a hue, and no hex literal exists outside `packages/tokens`** | 2.2 |
| **D6** | **No state is conveyed by colour alone.** Every state badge carries text, and the text is the state's name | 3.4 |
| **D7** | **No icon font.** Icons are vector components, and **no icon-only control exists except back, close and camera-flip** | 2.6 |
| **D8** | **No animation gates a state change.** Motion is decorative or it is absent | 2.5 |
| **D9** | **A toast never carries something the buyer must act on**, and never carries an error the buyer can do something about | 3.2 |
| **D10** | **`numberOfLines` is banned on any translated string that carries meaning** | 2.3 |
| **D11** | **The primary action of every screen sits in the bottom third**, and the scan screen's does not move | 6 |
| **D12** | **`PriceBlock` renders a product price and is forbidden from every other use.** It is the component a subscription price would arrive through | 5 |

---

## 1. The device this system is designed against

**Not the phone the developer owns.** ADU-PRD-01 S23 and ADU-PD-01 S14 make the binding constraint a **low-end Android, 2 GB of RAM, on a slow metered connection**. ADU-MOB-01 B17 makes a physical one a Tier 0 gate.

**Four more constraints that are not in any document and are real:**

1. **Large system text is common, not exceptional.** `allowFontScaling` is honoured everywhere, so **every component must survive its text growing by half again** without clipping or overlapping. A clipped payment instruction is a wrong bank transfer.
2. **Amharic runs 30-50% longer than English**, and the longest strings in the buyer app are the three disclosures -- the new-seller interstitial, the claim-evidence rule and the deletion explanation. **They are exactly the strings a designer will try to fit into a fixed card.**
3. **One hand, often, and at a doorway.** The buyer is holding a phone, a bag and possibly a code. **D11 is that constraint turned into a layout rule.**
4. **Sunlight.** The scan happens outdoors, at a gate or a shopfront, in Addis at midday. **The scan surface is the one screen in the app that is designed for high ambient light** -- maximum contrast, no thin weights, no subtle greys, and a viewfinder frame that reads at arm's length. **No document has said this before and it changes one component's colours** (S4.1).

---

## 2. Tokens

### 2.1 The package is values. It is never components

```text
packages/tokens/
|--- color.ts        semantic roles -> hex
|--- typography.ts   families, sizes, weights, line heights
|--- space.ts        the 4-point scale
|--- radius.ts
|--- motion.ts       durations and easings
|--- elevation.ts    shadow on iOS, elevation on Android
`--- index.ts
```

**No JSX, no React import, no platform import.** A file in this package that imports React has broken the reason the package exists -- the console and the app share values, not code, and a component here would be a component only one of them could use.

> **Enforced as an absence:** `packages/tokens` imports nothing but TypeScript's own types. Dependency-cruiser rule R-6, added to ADU-REPO-01 S5's four (S9 F5).

### 2.2 Colour

> **RULING D5 -- every colour token is named for what it does, never for what it is.** `surface.raised`, not `grey100`. `text.primary`, not `near-black`. `state.warning.fg`, not `amber600`.
>
> **A component that names a hue cannot be re-themed, and cannot be read.** *"Is `blue600` the brand colour or the link colour?"* has no answer, and the answer decides whether dark mode is a token file or a refactor (S7).
>
> **No hex literal exists outside this package.** Grep gate 12.

**The roles, complete. Every one of these is used by at least one component in S3:**

| Role | Used for |
|---|---|
| `bg.base` / `bg.raised` / `bg.sunken` | The screen, cards on it, and wells inside them |
| `text.primary` / `text.secondary` / `text.disabled` / `text.inverse` | The three reading weights, plus text on a filled control |
| `border.subtle` / `border.strong` / `border.focus` | Dividers, inputs, and the focus ring |
| `brand.base` / `brand.pressed` / `brand.subtle` / `brand.on` | The primary control, its pressed state, its tinted background, and text on it |
| `state.info` / `state.success` / `state.warning` / `state.danger`, each with `.fg` `.bg` `.border` | The four state families. **Three tokens each, because a coloured background needs a text colour that passes on it** |
| `scan.frame` / `scan.bg` / `scan.on` | **The outdoor set** (S4.1) |
| `skeleton.base` / `skeleton.sheen` | Loading |
| `overlay.scrim` | Behind sheets and modals |

**Contrast, non-negotiable and measured rather than eyeballed:**

- **4.5:1** for body text and any text under 18pt.
- **3:1** for text at 18pt or 14pt bold, and for **every non-text element that carries meaning** -- the state badge's border, the input outline, the focus ring, the viewfinder frame.
- **`scan.*` targets 7:1**, because the ambient-light case is not the office case.

> **RULING D6 -- no state is conveyed by colour alone.** Every state badge carries its state's name as text, every error field carries a message, every disabled control is disabled in the accessibility tree and not merely faded. **This is an accessibility rule and a sunlight rule at the same time**, which is why it is cheaper to obey than to argue about.

### 2.3 Typography, and the two traps that are specific to this script

**Two families, bundled, both of them:** **Inter** (Latin, digits, both platform names, the wordmark) and **Noto Sans Ethiopic** (Ge'ez).

> **RULING D2 -- the default text style is the Latin family, and no component ever sets an Ethiopic-only family.**
>
> React Native has no `unicode-range` and no font-family fallback list (B16). A `Text` with `fontFamily: 'NotoSansEthiopic'` renders **every Latin character and every digit** from that font or from whatever the platform substitutes -- and the platforms substitute differently. Setting Inter and letting the platform's own per-character fallback supply Ge'ez is the only arrangement that renders a mixed string correctly on both.
>
> **Grep gate 13:** `NotoSansEthiopic` appears in `assets/` and in exactly one line of `typography.ts`. Anywhere in `src/` it is a build failure.

> **RULING D1 -- `includeFontPadding: false` is banned, and this is the most specific thing in this document.**
>
> It is the standard React Native recipe for making Latin text sit tidily inside its box, it appears in every styling guide, **and on Android it clips the tops and bottoms of glyphs in scripts with large ascenders and descenders -- Ge'ez among them.** The result is Amharic text with its marks shaved off, on Android only, in a build that looks correct on the developer's iPhone and correct in English.
>
> **It is also invisible to the compile-time locale check**, which proves a string exists and nothing about whether it renders. **Grep gate 14**, and the release gate in ADU-PROJ-01 S12 is where it would otherwise be caught -- weeks later, by eye, if someone thought to look.

> **RULING D3 -- three weights per family, and the bundle is measured.**
>
> Regular, Medium, Bold. **No Light** -- a thin weight is the first thing to disappear in sunlight and the first thing to fail contrast. **No italic** -- Noto Sans Ethiopic has no true italic and a synthesised one is a smear.
>
> **Six font files against a 30 MB Android download budget** (ADU-MOB-01 S13). This document states no size, because a stated size goes stale here first (ADU-MOB-00 S1.1): **the Tier 0 gate measures the bundle with the fonts in it**, and if the number is uncomfortable the answer is fewer weights, not a smaller script.

**The scale. Every size is a token; no component writes a number.**

| Token | Use |
|---|---|
| `display` | The wordmark, and the scan screen's one instruction |
| `title` | Screen titles, the order total |
| `heading` | Section headings, product name on MB-07 |
| `body` | Everything a buyer reads |
| `bodyStrong` | The same size, Medium weight -- **emphasis is weight, never colour** (D6) |
| `caption` | Freshness stamps, timestamps, the badge's text |
| `mono` | **The account number, the transaction reference, the request id.** Tabular figures, and it is the only place a monospace family appears |

**Line height is a token, never a literal, and it is set from the Ethiopic metrics rather than the Latin ones.** A line height tuned to look tight in English is a line height that collides in Amharic. **Every size token carries its own line height** and no component overrides it.

> **RULING D10 -- `numberOfLines` is banned on any translated string that carries meaning.** Product names, seller names, error messages, disclosures, button labels. **A truncated Amharic sentence is a sentence the buyer cannot act on**, and the same string fits in English, which is how this ships undetected. It is permitted only on a message preview in MB-30, where truncation is the design.

### 2.4 Space, radius, elevation

**A 4-point base scale**: `0, 1(4), 2(8), 3(12), 4(16), 5(24), 6(32), 7(48), 8(64)`. Nothing between.

**Radius:** `sm(6)` for inputs and badges, `md(12)` for cards and sheets, `full` for the avatar and the pill.

**Elevation is two levels and no more:** `raised` for a card, `overlay` for a sheet. Android renders it as `elevation`, iOS as a shadow, and the token holds both. **A third level is a design that is using depth to say something a border should say.**

> **RULING D4 -- there is no height token, and no container holding text has a fixed height.**
>
> ADU-REPO-01 already carries the rule for the console -- *"no fixed heights on anything holding translated text"* -- and mobile has the harder version, because `allowFontScaling` can grow the same string again on top of the translation. **A card sized to fit English at the default text size is a card that clips Amharic at the largest one**, which is the exact combination the reference device will be set to.
>
> **`minHeight` is permitted** -- it sets a floor and nothing clips. `height` on anything containing a `Text` is a defect.

### 2.5 Motion

**Three durations:** `fast(120ms)` for a press, `base(200ms)` for a sheet or a transition, `slow(320ms)` for a full-screen change. One easing for entrances, one for exits.

**`prefers-reduced-motion` is honoured** via the OS accessibility setting: transitions become cross-fades and nothing translates.

> **RULING D8 -- no animation gates a state change.** A state renders when the data arrives. **Nothing waits for an animation to finish before it is interactive**, nothing animates a number counting up, and nothing plays a success animation that delays the next control. On a 2 GB Android the animation is where the frame budget goes, and at a doorway the delay is where the buyer's patience goes.

**The skeleton's sheen is the one exception** and it is stopped by reduced motion.

### 2.6 Icons

> **RULING D7 -- no icon font, and almost no icon-only controls.**
>
> **An icon font is a third font family** competing for the same fallback machinery that D1 and D2 exist to protect, and a missing glyph in an icon font renders as the same empty box a missing Ge'ez glyph does -- which makes the release gate ambiguous. Icons are vector components.
>
> **Every control has a text label**, except three the platforms have taught everyone: **back**, **close**, and **camera flip**. Each of those still carries an accessibility label. **Everything else -- follow, report, block, copy, share, cancel -- is a labelled control**, and in Amharic the label is what makes it legible at all.

**One icon set, one weight, sized from the space scale.** No two icons of the same concept.

---

## 3. The component inventory

**Twenty-eight components. Every screen in ADU-MOB-02 is built from these**, and a screen that needs a twenty-ninth has found a gap in this document rather than an excuse.

Each entry gives: what it is, its variants, its states, its accessibility contract, and the screens that use it.

### 3.1 Primitives

| # | Component | Variants | States | Used by |
|---|---|---|---|---|
| **P1** | **`Text`** -- the only text component; applies the scale and D1/D2 | The seven size tokens | -- | Everything |
| **P2** | **`Button`** | primary, secondary, quiet, destructive | idle, pressed, **`SENDING` with its label replaced by the in-progress label, not by a spinner alone**, disabled | Everywhere |
| **P3** | **`Field`** -- label, input, helper, error | text, phone, code, multiline | idle, focused, `VALIDATION`, disabled | MB-04, MB-24, MB-26, MB-27 |
| **P4** | **`Sheet`** -- bottom sheet | standard, full | -- | MB-19, MB-23, MB-28, MB-29 |
| **P5** | **`Skeleton`** | line, block, card | -- | Every `LOADING` state |
| **P6** | **`Banner`** -- an inline, persistent message | info, warning, danger | -- | MB-16, MB-11 |
| **P7** | **`Toast`** -- transient confirmation only | success, info | -- | Follows, copies, read-all |

> **RULING D9 -- a toast never carries anything the buyer must act on, and never carries an error the buyer could fix.**
>
> A toast is dismissed by time, and the buyer at a doorway or in a bank app is not looking. **Errors are `Banner` or a field message; anything requiring a decision is a `Sheet`.** A toast confirms something that already happened and cost nothing -- *followed*, *copied*, *marked read*.

**`Button` in `SENDING` keeps its width.** A control that shrinks to a spinner moves everything under it, and on the reserve and scan screens that is the control the buyer's thumb is already over.

### 3.2 Commerce

| # | Component | Notes | Used by |
|---|---|---|---|
| **C1** | **`ProductCard`** -- three densities: `grid`, `list`, `line` | **The density chooses the image derivative**: grid -> thumbnail, list -> card, line -> thumbnail. **Never `full` in a list** -- ADU-MOB-01 S8.1 makes this the single largest data cost in the app | MB-01, MB-02, MB-06, MB-09 |
| **C2** | **`PriceBlock`** -- amount and currency, formatted through `Intl` | **D12. Product prices only** | MB-07, MB-11, MB-12, MB-16 |
| **C3** | **`StockLine`** -- availability **and its `confirmed_at`** | **The stamp is not optional** (M5). A stock claim with no "as of" is a claim the app cannot support | MB-07, MB-11 |
| **C4** | **`LineItem`** -- product, variant, quantity, price, line state, **`available_checked_at`** | Carries the per-line action slot for cancel and for reconciliation | MB-11, MB-12, MB-13, MB-16 |
| **C5** | **`RatingPair`** -- the item rating and the handoff rating, **side by side and never averaged** | Read and write variants. **There is no single-number variant, and adding one would break ADU-PRD-01's review model in a component** | MB-10, MB-24 |
| **C6** | **`SellerStrip`** -- handle, logo, trust level, completed handoff count, follow control | **Counts, never adjectives** (ADU-MOB-02 S4.1) | MB-06, MB-07, MB-16 |
| **C7** | **`FollowButton`** | following, not following, `SENDING`. **Available before purchase, from every surface where a seller is identified** | C1, C6 |

### 3.3 Order and state

| # | Component | Notes | Used by |
|---|---|---|---|
| **O1** | **`OrderCard`** -- the state block, the clock slot, the lines, **the action region** | **One component, one server-driven action region** (M4). The variant is the order's state and nothing else | MB-15, MB-16 |
| **O2** | **`StateBadge`** | **Text plus colour, never colour alone** (D6). **Has a default branch**: an unrecognised state renders the server's own string in the neutral variant, not a blank | O1, MB-13, MB-22, MB-26 |
| **O3** | **`Countdown`** -- **two labelled forms** | S4.2. **There is no unlabelled variant** | O1, MB-16 |
| **O4** | **`ActionRegion`** -- exactly one primary action for the current state | Renders from `allowed_actions`. **An unrecognised action renders nothing, never a guess** | O1 |
| **O5** | **`HistoryList`** -- append-only, plain language, timestamped | Absolute times with the timezone, never relative | MB-16, MB-26 |
| **O6** | **`ItemsList`** -- renders a 409's `items[]` | **Every item, never the first.** Used by reconciliation, deletion blockers and claim evidence -- three screens whose whole correctness is that they render the complete list | MB-13, MB-37 |

### 3.4 The four that carry a ruling

| # | Component | Ruling |
|---|---|---|
| **R1** | **`ScanViewfinder`** | S4.1 |
| **R2** | **`DisclosureInterstitial`** | S4.3 |
| **R3** | **`CopyField`** | S4.4 |
| **R4** | **`EmptyState`** | S4.5 |

### 3.5 Chrome

| # | Component | Notes |
|---|---|---|
| **H1** | **`TabBar`** -- four tabs | **No badge count on Orders that could be wrong.** An unread marker is a dot, not a number, because a number from a stale read is a lie the buyer acts on |
| **H2** | **`ScreenHeader`** -- title, back, one optional action | The title wraps. It never truncates (D10) |
| **H3** | **`ErrorState`** -- full-screen transport failure, **with the request id in selectable text** | The retry is a `Button`, not a link |
| **H4** | **`Chip` / `ChipRow`** -- the chat's structured replies | **Chips carry the load in Amharic, deliberately.** Horizontally scrollable, each chip wraps to two lines rather than truncating |

---

## 4. The four components that carry a ruling

### 4.1 `ScanViewfinder` -- and the only outdoor design in the app

**Four states, and the difference between them is the whole of ADU-MOB-02 M1.**

| State | The component |
|---|---|
| **Framing** | Camera preview, a high-contrast frame at `scan.frame`, the order named above it, one line of instruction at `display` size. **`Complete without scanning` is a quiet text control below the frame** -- present, plainly labelled the weaker record, and **not a `Button`** (M6) |
| **`SENDING`** | The frame dims, the preview freezes on the decoded frame, **`Sending -- not yet recorded`** at `title` size. **No success. No checkmark. Nothing green** |
| **`RETRYING`** | The same, plus **`Retry now`** as a primary `Button`, plus the elapsed attempt. **At twenty seconds `Complete without scanning` is promoted from a text control to a secondary `Button` beside it** |
| **Outcome** | Renders `O2` from the server's `outcome` and nothing the client inferred |

**The colours are the exception in this system.** `scan.*` targets **7:1**, uses the Bold weight, and uses no subtle grey anywhere -- because this is the one screen used at midday in direct sun, at arm's length, by someone who cannot stop to shade the phone. **Every other surface may use the ordinary palette; this one may not.**

**Three prohibitions the component enforces structurally:**

- **It has no navigation of its own.** It cannot route away, so the retry loop cannot lose the buyer's place.
- **It has no auto-complete path.** There is no code path from a timeout to `confirm-receipt`; the tap is always a tap.
- **It renders no outcome it was not given.** There is no optimistic success state to accidentally reach.

> **`DEVICE_PERMISSION_NEEDED` is a first-class state of this component, not an error.** Camera refused renders what the camera is for and the route to Settings, **and keeps `Complete without scanning` available** -- a buyer who will not grant the camera must still be able to complete their order.

### 4.2 `Countdown` -- two forms, and there is no third

> **RULING M12 restated as a component contract: `Countdown` has no unlabelled variant.**

| Variant | Renders |
|---|---|
| `mine` | The deadline **and what the buyer must do before it** |
| `theirs` | The deadline **and whose it is** -- *the seller is checking your payment and must answer by...* |

**There is no `bare` variant and no `duration` prop that takes a number.** The component takes an **absolute RFC 3339 instant** the server supplied and formats it with `Intl` against the market timezone.

**It never decides anything at zero.** It re-reads and renders what the server says. **A component that could hide an action at zero is the client computing business state**, and this one structurally cannot: it has no callback.

**At `PAYMENT_CONFIRMED` the component is not rendered at all.** The order card's clock slot is empty, and **what fills it is blocked on the fulfilment window** (ADU-MOB-02 S19 Q5).

### 4.3 `DisclosureInterstitial` -- the shape is the ruling

**Full screen. One continue control. No dismiss, no "don't show again", no scroll-to-accept checkbox.**

> M7: a banner above a Reserve button is buried, and a checkbox turns a disclosure into a consent to click through. **A screen the buyer advances past is the only shape that satisfies ADU-PRD-01 S5.3.**

**It is used exactly twice, and both uses are content-owned:** the new-seller disclosure (MB-14) and the claim-evidence rule (MB-27). **A third use would mean somebody is putting an ordinary message in an extraordinary container**, which is how the extraordinary one stops being read.

**It emits its event on mount**, not on continue -- the requirement is that it was shown.

**Layout note that is not cosmetic:** the continue control sits in the bottom third (D11) **and the body scrolls above it**. At the largest text size in Amharic the new-seller disclosure is longer than any screen, and a continue control that scrolls off is a disclosure the buyer skips by scrolling.

### 4.4 `CopyField` -- the payment screen's whole security posture

**Label, value in `mono` with tabular figures, and an explicit copy control.**

> **Nothing is placed on the clipboard automatically** (M9). A copy happens on a tap the buyer made. On iOS an automatic clipboard read shows the system paste banner, which reads to a buyer as the app taking something.

**The value is selectable.** A buyer who does not trust the copy control must be able to read and select the number.

**The component holds no persistence of any kind** -- no recent values, no autofill memory, no analytics. **It is used on MB-17 for the account number, the amount and the reference, and on H3 for the request id, and nowhere else.**

**A copy emits a `Toast` (D9) and nothing more.**

### 4.5 `EmptyState` -- the three-part contract, enforced by the props

**ADU-PRD-01 S23.2:** *"Every list surface defines an empty state... It is never a bare icon, an apology, or a blank region."*

**The component's props make the rule structural:**

```text
EmptyState({
  what:   string   // what will appear here            REQUIRED
  why:    string   // why it is worth having           REQUIRED
  action: Action | ExplicitlyNone                      REQUIRED
})
```

> **`action` has no default.** A screen with nothing useful to offer passes `ExplicitlyNone` **with the reason** -- which is what MB-10, MB-25 and MB-30 do, and what makes *"an empty claims list is good news"* a rendered sentence rather than an omission.
>
> **A required prop is cheaper than a review checklist**, and this is the one rule in the product that has an empty-state defect waiting behind every list.

---

## 5. What is not in this system

**No third-party component library** -- it would be a dependency with a design opinion, a bundle cost and, in several popular cases, its own icon font (D7).

**No icon font. No date picker** -- nothing in Buyer Mode picks a date. **No carousel with auto-advance.** **No modal that traps focus** -- everything is a `Sheet` with a back gesture. **No tooltip** -- a tooltip is a label that did not fit, and D10 says the label must fit. **No infinite-scroll spinner at the bottom of a list without a stop** -- cursor pagination ends, and the end is a rendered sentence.

**No accordion on a disclosure.** **No progress bar for anything that is not a real byte count** -- MB-18's upload has one because it has real progress; nothing else pretends.

> **RULING D12 -- `PriceBlock` renders a product price and nothing else.**
>
> **It is the component through which a subscription price would arrive.** Someone building a seller-facing surface later, or reusing a component sensibly, is one import away from a tier price rendering in the buyer's binary -- and the CI string gate scans `packages/locale`, not a number that came from an API. **So the component is named for products, documented as products-only, and its absence anywhere near a tier is a review item.**
>
> There is no `SubscriptionPrice`, no `TierBadge`, no `UpgradePrompt`, no `PlanCard`. **Not disabled. Not present** (ADU-MOB-02 M2).

---

## 6. Layout, density and the one-handed rule

> **RULING D11 -- the primary action of every screen sits in the bottom third, within thumb reach, and it does not move.**

**A control that moves when a banner appears, when text scales, or when a keyboard opens is a control the buyer mis-taps** -- and on MB-12 and MB-18 the mis-tap costs money.

- **Primary actions are pinned**, not at the end of a scroll.
- **A pinned action reserves its space when it is hidden**, so nothing reflows when it appears.
- **Nothing interactive sits under the system gesture bar** on either platform. The safe-area inset is a layout input, not a padding afterthought.
- **44x44pt minimum for every target**, with at least 8pt between adjacent ones -- ADU-MOB-02 M11's sign-out/delete separation is this rule doing its most important work.
- **The keyboard never covers the field being typed into or its error message.** The error message is the half people forget, and on MB-04 it is the whole of what the buyer needs to see.

**Two densities only:** the default, and the `line` density used inside lists. **A third density is a decision nobody will apply consistently.**

---

## 7. Dark mode, deferred -- and what makes it a token file rather than a refactor

**Buyer Mode ships light-only at MVP.** *(MVP means MVP -- ADU-MOB-01 S0.)*

**The cost of deferring is small and real:** both platforms have a system setting, some buyers use it, and an app that ignores it looks unfinished at night. **The cost of doing it badly is larger**: a half-migrated dark theme produces unreadable text on one screen in one state, which is exactly the class of defect that reaches a store review and not a test.

> **What makes it cheap later is already done here.** D5 -- every colour is a semantic role, no component names a hue, no hex outside `packages/tokens`. **Dark mode is then a second value map behind the same role names**, plus a contrast re-check, plus one release-gate pass on the reference devices.
>
> **The reopen trigger:** the first release after launch where store reviews or the founders' own use raise it, taken as one PR that touches `color.ts` and nothing under `src/`. **If it turns out to touch anything under `src/`, D5 was not obeyed and that is the finding.**

**One thing that is not deferred:** the app respects the system setting for **text size and reduced motion** from day one. Those are accessibility settings, not a theme.

---

## 8. How this is enforced

**Three grep gates join ADU-MOB-01 S18.1's eleven**, and one dependency-cruiser rule joins ADU-REPO-01 S5's four. **All of them are repository-wide, never path-filtered** -- a gate that runs only when someone touches `apps/mobile` is off on exactly the push that moves a literal into a shared package.

| # | Check | Expected |
|---|---|---|
| **12** | A hex colour literal (`#rrggbb`) anywhere outside `packages/tokens` | **0** (D5) |
| **13** | `NotoSansEthiopic` anywhere under `apps/mobile/src` | **0** (D2) |
| **14** | `includeFontPadding` anywhere | **0** (D1) |
| **R-6** | `packages/tokens` importing anything | **0** (S2.1) |

**Two more that are checks rather than greps**, because a grep would produce false positives a solo engineer would learn to ignore:

- **`height:` with a numeric value on a component containing `Text`** -- a lint rule, not a grep (D4). `minHeight` passes.
- **`numberOfLines` outside MB-30** -- a lint rule with one allowed path (D10).

> **And the check no automation performs.** *"Every screen renders in Amharic, at the largest OS text size, with no missing-glyph box"* is a person, on a device, in ADU-PROJ-01 S12's release gate. **D1 is invisible to every other check in this list** -- it compiles, it passes the locale gate, it looks perfect in English on iOS, and it clips Ge'ez on Android. **Gate 14 exists because the human check happens once per release and the mistake is made every day.**

---

## 9. Findings

**Five. Two are defects in documents this workstream already issued.**

| # | Finding | Kind | Where |
|---|---|---|---|
| **F1** | **ADU-MOB-01 v1.1 S3.4 still lists *"the scan-queue view model"* among the things Zustand holds.** The queue was withdrawn in the same version. **This is the over-deletion warning working in reverse** -- ADU-MOB-AMD-01 warned about deleting one thing too many, and what actually happened is that one line was deleted too few, in the section a builder reads to decide what the client store contains | **Residue of a withdrawn feature** | ADU-MOB-01 S3.4 |
| **F2** | **`packages/tokens` is consumed by ADU-CON-03 and authored by no document.** The console has been built against a package whose values were never written down, which means they are hard-coded somewhere or invented per component | **Absence, and a reconciliation nobody owns** | S0.1 |
| **F3** | **No document states the contrast requirement for the mobile app.** ADU-CON-03 S15 carries the console's accessibility baseline; the mobile equivalent existed only as *"no state by colour alone"* until S2.2 | **Absence** | S2.2 |
| **F4** | **The `includeFontPadding` trap is in no document, in no guideline, and is the standard advice everywhere else.** It defeats the compile-time locale check, the CI gates and the type system, and surfaces only in a human pass on an Android device | **Build-time trap, and a new one** | D1 |
| **F5** | **ADU-REPO-01 S5's dependency rules do not constrain `packages/tokens`**, so nothing prevents a component -- or a React import -- landing in the one package both surfaces depend on | **Absence** | S2.1 |

> **F4 is the one worth the most.** It has the shape ADU-MOB-01 F1 has: **a plausible, well-documented, widely-recommended implementation that quietly breaks a binding requirement**, catchable today for the cost of one grep and otherwise found by eye, on a device, in the release gate, in Amharic, on Android only.

**Documents to reissue:**

| Document | Change |
|---|---|
| **ADU-MOB-01 -> v1.2** | S3.4's Zustand list loses *"the scan-queue view model"* (**F1**)  -  S18.1 gains gates 12-14 (S8) |
| **ADU-REPO-01 -> v1.4** | S5 gains **R-6** (**F5**)  -  S7's repository-wide gate list gains 12-14, alongside the 10 and 11 ADU-MOB-01 v1.1 already owes it |
| **ADU-CON-03 -> v1.4** | S15's accessibility baseline cites this document for the shared token values, and the console's reconciliation against them is scheduled (**F2**) |
| **ADU-MOB-02** | Unchanged. This document is its counterpart, not a correction to it |

---

## 10. Open items

| # | Item | Blocks | Note |
|---|---|---|---|
| **Q1** | **The brand hue.** `brand.base` is the one value in `color.ts` that is a founder decision rather than a derivation | Nothing yet -- **the roles work with any hue** | Every other brand token derives from it by a stated rule: `pressed` is one step darker, `subtle` is the same hue at low saturation, `on` is whichever of `text.primary` or `text.inverse` passes 4.5:1 against it. **Pick the hue and the other three are computed**, which is the point of D5 |
| **Q2** | **Which icon set, and its licence** | Tier 0's dependency manifest | It is a dependency and therefore a B2 decision: named in the PR, checked, and **it must not be an icon font** (D7) |
| **Q3** | **The measured font bundle** | Tier 0's gate | D3 says three weights and says the number is measured rather than asserted. **If six files are uncomfortable against the 30 MB budget, drop Medium before dropping a script** |
| **Q4** | **Dark mode's reopen** | Nothing | S7. Deliberately not scheduled |
| **Q5** | **The console's token reconciliation** (**F2**) | Nothing in this workstream | It is the console's work and it is recorded so it is not discovered during a redesign |

---

## 11. What ADU-MOB-04 takes from here

**The wireframe brief pairs this document with ADU-MOB-02 and needs nothing else.** Each `MB-nn` brief names its regions in reading order (MOB-02), its states (MOB-02 S3), and **the component from S3 that renders each region** (here). A wireframe that draws a control this inventory does not contain is wrong against this document; a wireframe that draws a state MOB-02 does not list is wrong against that one.

**Where the two documents disagree, ADU-MOB-02 wins** -- it owns what the buyer sees, and this owns what it is made of.

> **And the expectation, stated in advance because the console paid for learning it.** Two rounds of wireframes against ADU-CON-03 v1.0 found two defects in the document itself. **Expect the same here, and expect them to be in S3** -- a component whose variants are one short, or a state some screen needs that no component has. **That is what drawing the screens is for**, and the fix goes into this document before it goes into a component.

---

*Binding design system, v1.0, and the authoring document for a shared token package that has been imported for months and specified never. Twelve rulings, twenty-eight components, three new grep gates and one new dependency rule. **The one worth reading twice is D1**: `includeFontPadding: false` is the standard React Native recipe for tidy Latin text, it appears in every styling guide, and on Android it shaves the marks off Ge'ez -- in a build that compiles, passes the locale check, passes every gate in ADU-MOB-01 S18.1, and looks perfect in English on an iPhone. It is the same shape as the signing sentence in the API contract: **a plausible implementation that a binding requirement forbids, invisible to everything except a person holding the right device.** Five findings go back to other documents and two of them are defects in this workstream's own -- including a line in ADU-MOB-01 v1.1 that still names the scan queue the same version deleted. **ADU-MOB-04, the wireframe generation brief, is next, and it is the first document in this series that produces something you can look at.***
