# ADU-WEB-01 — Adulis Public Website Specification

**Version:** 1.0 · **Baseline date:** 23 August 2026
**Owner:** Founder / CEO
**Status:** Binding specification for the public website. Supersedes the ad-hoc wireframe briefs.
**Supersedes:** Adulis Website Wireframe Brief v4 · Correction Brief v4.1 *(both retained as design history)*
**Related:** ADU-00 v9.0 · ADU-PROJ-01 v9.0 · ADU-PRD-01 v8.5 · wireframe set v4.1 (114 frames)

> Where this document and any wireframe brief disagree, this one governs. Where this document and ADU-PRD-01 disagree on **product behaviour**, the PRD governs — this document describes only what the website says about that behaviour.

> Where a rule is marked **INVARIANT**, it must hold in code or in review, not in intention.

---

## 1. What this document is

ADU-WEB-01 specifies the **public marketing website**. It answers what the site is for, what it may claim, what it must contain, and when it is finished.

It exists because until now the only durable record of the website was a wireframe brief and code comments. A brief describes one revision; a specification survives them.

**Reading order for a new team member:** ADU-00 → ADU-PROJ-01 → ADU-PRD-01 → ADU-WEB-01.

### 1.1 The boundary with the product

Two things live on the public web and they are **not the same deliverable**:

| Surface | Owned by | Scope |
|---|---|---|
| **Marketing pages** — home, how it works, for sellers, for buyers, trust, legal, help, waitlist, deletion | **This document** | Explaining Adulis and recruiting sellers |
| **Seller storefronts** — the page a bio link resolves to | **ADU-PRD-01 §3.1, §7** | Product surface that happens to be served on web |

They share a domain, a design language and a codebase. They do not share a specification, and storefronts are **out of scope here**.

---

## 2. Purpose

**The website has two audiences and one commercial goal.**

| | Audience | What they need | What they can do today |
|---|---|---|---|
| **Primary** | Sellers on TikTok and Instagram | To understand whether this is worth their time | **Join the waitlist** |
| **Secondary** | Buyers who follow those sellers | To understand what Adulis is when they arrive from a bio link | Read. The apps have not shipped. |

**INVARIANT — the waitlist is the only conversion on the site.** There is no other form that produces a commercial outcome, and no other call to action competes with it.

### 2.1 Why the site is seller-weighted, not split

The buyer path currently ends in "coming soon." Giving it equal prominence would give equal weight to a door with nothing behind it.

The structure is therefore: a **seller-weighted home page with one clearly marked door to the buyer side**, and a full buyer page at its own URL. Not a rotating hero, not two parallel sites.

**Why not a rotating hero.** It delays the answer to "who is this for" rather than giving it; a seller landing on the buyer slide reads copy that is not about them. It also forces both slides to share a container height, which is the fixed-height failure in §5.3 made structural rather than accidental.

**Why not two sites.** It doubles the page count, the translation work and the maintenance against one engineer, and it breaks link sharing — someone sending the domain to a friend cannot control which side they land on.

**This balance is expected to change.** When the apps ship, the buyer door becomes a download and deserves more prominence. That is a copy and layout change, not a rebuild — which is the point of putting the buyer page at a real URL now.

---

## 3. Copy invariants

These are the claims the site may and may not make. Each traces to a product, legal or regulatory constraint.

### 3.1 Never claim

**INVARIANT — the website never states or implies that Adulis protects buyers.** There is no escrow. Buyer protection is the unresolved gap that waits on the NBE licence (ADU-PROJ-01 §3.4). Forbidden: *buyer protection · protects buyers · guaranteed · safe purchase · secure transaction · we make sure · we check* — and any synonym.

**INVARIANT — the website never characterises a seller.** No *scammer · fraud · risky · unproven · trustworthy · verified safe*. Adulis publishes counted facts from its own records (ADU-PRD-01 §13.2).

**INVARIANT — the website never implies Adulis verifies a payment.** The seller checks their own bank account. Adulis relays evidence and records what both parties did (ADU-PRD-01 §10.1).

### 3.2 Never misstate

**INVARIANT — the buyer scans a QR code at handoff.** Never "confirms receipt", which is a weaker, separate evidence tier that does not count toward trust level (ADU-PRD-01 §11.3). The distinction is the whole trust architecture; softening it on the marketing site undercuts the product's only real differentiator.

**INVARIANT — the seller's Adulis link lives in their bio.** Neither platform permits a per-post outbound link (ADU-PRD-01 §21.0). No page, image, diagram or caption may depict or describe one.

**INVARIANT — `EXAMPLE` tags mark illustrative seller cards only.** The home hero and the How-it-works shop mock show a made-up seller and must be tagged. **New**, **Established** and **Trusted** are the real level names and are never tagged — only their thresholds are undecided, and the accompanying note says so.

### 3.3 Never publish

**INVARIANT — no pricing.** No pricing page, no tier table, no monetary figure for a subscription. Pricing is not public during the controlled beta.

**INVARIANT — no follower threshold.** No number, no minimum, no "guide". There is no rejection path on follower count — every applicant is accepted and reviewed (ADU-PROJ-01 §3.1). The site must not imply a bar exists.

**INVARIANT — no public launch date.**

### 3.4 Commercial sequence — what the site may say

The seller's commercial journey has three stages, and the site must describe them consistently because a seller who discovers a cost at conversion churns, and is right to.

| Stage | What it is | Chatbot |
|---|---|---|
| **Controlled beta** | Hand-picked cohort who help build the first product | **Free** |
| **Open free period** | 60 days from each seller's own signup, all features **except the blue tick** (ADU-PRD-01 §16.3) | **Free** |
| **Paid tiers** | After that | Paid capability |

**INVARIANT — where the site mentions the chatbot on a seller-facing page, it states that it is free during the beta and during the first 60 days, and paid thereafter.** Stating only the second half is a bait; stating only the first half is a surprise later.

⚠ **Correction required to the built site.** The For Sellers page currently reads *"Available from a paid tier after the beta."* That is incomplete — it omits the 60-day open period. Replace with: *"Free during the beta and for your first 60 days. Part of a paid plan after that."*

This is not a price and does not breach §3.3.

---

## 4. Information architecture

Sixteen routes, all locale-prefixed. **T1** ships first.

| Wireframe | Route | Tier | Job |
|---|---|---|---|
| W01 | `/` | T1 | Seller hero, three value cards, buyer door, cohort block |
| W02 | `/how-it-works` | T1 | Five steps, shop preview, paste flow, money boundary |
| W03 | `/for-sellers` | T1 | Full seller pitch. **The waitlist form lives here**, at `#waitlist` |
| W23 | `/for-buyers` | T1 | Buyer page. Store badges disabled. Honest limits block. |
| W04 | `/trust-and-safety` | T1 | Boundaries, verification, ladder, published statistics, claims |
| W05 | `/prohibited-products` | T1 | Twelve categories, one statement below |
| W17 | `/about` | T1 | Origin story, three founders, company |
| W22 | `/delete-account` | T1 | **App-store precondition.** Five states. |
| W20 | 404 | T1 | Routes back to home and help |
| W11 | `/help` | T2 | Eleven questions, accordion |
| W12 | `/contact` | T2 | Three states, consent line |
| W13 | `/terms` | T2 | Eleven sections, anchor sidebar |
| W14 | `/privacy` | T2 | Fourteen sections, anchor sidebar |
| W15 | `/refunds-and-disputes` | T2 | Seven sections, anchor sidebar |
| W16 | `/seller-terms` | T2 | Twelve sections, anchor sidebar |
| W21 | `/report-content` | T2 | Form and success. Becomes an app-store requirement on app launch. |

**INVARIANT — every route resolves.** A 404 behind *Privacy* or *Delete my account* is a legal and app-store problem, not a cosmetic one. Unbuilt Tier 2 routes render a visibly-unbuilt placeholder, never a 404.

### 4.1 Navigation

**Header:** How it works · For sellers · For buyers · About · Trust & Safety · Help, plus the language switcher and the waitlist button.

**Footer row 1:** the six above, plus Contact.
**Footer row 2:** Terms · Privacy · Seller Terms · Refunds & Disputes · Prohibited Products · **Report content** · **Delete my account**.

**INVARIANT — the footer appears on every page and contains all seven row-2 links.** Two of them are app-store requirements and one is a data-protection requirement.

**INVARIANT — navigation is defined once and read by the header, the mobile menu and the footer.** A link cannot exist in one and not the others.

**INVARIANT — there is no "Log in" link, in any language, in any menu.** See §6.1.

---

## 5. Global interface rules

### 5.1 Mobile

**Mobile first, responsive to desktop.** The product's target seller is on a low-end Android; the site's investor and press readers are on laptops. Both matter, in that order.

**INVARIANT — every page is complete and usable at 360px with no horizontal scrolling.**

**INVARIANT — mobile navigation exists.** A hamburger at a 44×44px minimum target, opening a panel with all six nav items, the language switcher and a **full-size** waitlist button. It closes on Escape and on navigation, and the trigger becomes a close icon while open.

**INVARIANT — mobile carries the same content as desktop.** Two-column sections stack; nothing is deleted.

### 5.2 Forms

**INVARIANT — submit buttons are always enabled.** A disabled button cannot take keyboard focus, so a keyboard user gets no way to trigger validation and no explanation of why nothing happened.

**INVARIANT — validation is server-side.** The client never decides whether a submission is valid.

**INVARIANT — every form works with JavaScript disabled.**

**INVARIANT — an error summary is a list of links**, one per invalid field, each moving focus to the field it names. Never a single sentence.

**INVARIANT — required fields are marked before submission**, not after.

**INVARIANT — every validation message has its own vertical space.** In Amharic, a message set tight against its label collides with it.

**INVARIANT — every public form is rate limited.**

### 5.3 Layout

**INVARIANT — no container has a fixed height.** Cards, buttons and sections size to their content. A fixed height hides Amharic overflow instead of revealing it, which converts a visible bug into an invisible one.

**INVARIANT — identical body text is never repeated across sibling cards.** If six cards would carry the same sentence, the sentence belongs once, below the set.

**INVARIANT — no placeholder text ships.** Every element says something specific, or is a visibly flagged undecided item under §11.

### 5.4 Structural devices

Numbered markers appear **only where the content is genuinely a sequence** — the five steps on How it works, the four on For buyers. Value cards, boundary cards and category lists are sets, not sequences, and numbering them asserts something untrue.

Arrows are real glyphs — `→` and `↓`, never `>` or `v`.

---

## 6. The two authenticated exceptions

The site is anonymous. Two things are not, and both are narrow by design.

### 6.1 There is no web sign-in

**INVARIANT — the public website has no account, no session, no cart, no reservation, no chat and no review.** Every seller and buyer action happens in the app (ADU-PRD-01 §3.0).

This holds until the seller console arrives post-MVP. Until then, any "Log in" affordance is a promise the product cannot keep.

### 6.2 Account deletion — W22

Required by both app stores before either app may be submitted. **It ships with the website, not with the app.**

**INVARIANT — the deletion page explains what deletion does BEFORE asking for a phone number.** A person should know what they are requesting before identifying themselves, and a store reviewer looks for the explanation on the landing step.

**INVARIANT — the OTP proves identity for the deletion request alone.** It issues no session, grants access to no other surface, and the page states in its own copy that it is not a sign-in.

Five states, in order: **explain → phone → OTP → confirm → success**, with a sixth branch:

**INVARIANT — a seller with unresolved obligations sees a blocked state listing exactly what is outstanding** and what resolves each item (ADU-PRD-01 §16.9). Deletion cannot proceed until they clear.

**INVARIANT — the confirm step offers a cancel, and requires an explicit acknowledgement.** An irreversible action always offers a way out.

The page states plainly, per ADU-PRD-01 §16.9, that reviews are anonymised rather than deleted and that the verification record is retained.

---

## 7. The waitlist

The site's only conversion, and the intake for the entire beta cohort.

### 7.1 Fields

| Field | Type | Required |
|---|---|---|
| Full name | text | Yes |
| Phone number | tel | Yes |
| **Primary platform** | **select — TikTok / Instagram** | Yes |
| Primary handle | text | Yes |
| Also sell on | select — TikTok / Instagram / Neither | No |
| Second handle | text, revealed conditionally | No |
| Follower count (approx.) | number | **No** |
| What do you sell? | text | Yes |
| City | text | Yes |
| Consent | checkbox linking to Privacy | Yes |

**Platform is a select, not free text**, because eligibility depends on it and a typed platform name cannot be joined to anything.

**Two handles are captured** because a seller on both platforms is assessed on their **highest single account, never the sum** (ADU-PRD-01 §4.1). Capturing both is what makes that comparison possible later.

**INVARIANT — follower count is optional and never validated against a threshold.** It is an input to the decision the beta exists to make, not a gate. There is no rejection path.

**INVARIANT — the conditional second-handle field is present without JavaScript.** It starts visible and is only narrowed once the page has hydrated.

### 7.2 Response

**INVARIANT — every applicant is accepted onto the list.** The submitted state shows a reference number, states what happens next with a realistic timeframe, and offers a way to correct a mistyped phone number.

⚠ **The stated timeframe is a staffing commitment.** The site promises 5–7 business days. Every application is read by a founder (ADU-PROJ-01 §8.2). If volume outruns review, the promise breaks before the product does.

### 7.3 Waitlist data

**INVARIANT — the retention period stated in the consent line, the retention period stated in the privacy notice, and the retention period actually implemented are the same number.** Currently **12 months**.

This is personal data collected before any account exists, under Proclamation 1321/2024. **The DPIA must cover it before the first submission is taken** (ADU-PROJ-01 §14).

---

## 8. Language

### 8.1 Both locales, route-prefixed

**INVARIANT — every page exists in English and Amharic at `/en/…` and `/am/…`.**

Route prefixes rather than a cookie, so a shared link lands in the language it was shared in, both trees index, and language selection does not depend on JavaScript.

**INVARIANT — the language switcher renders both scripts at all times: `EN / አማርኛ`.**

### 8.2 The font stack

**INVARIANT — the font stack declares a Latin family first and an Ethiopic family as fallback**, per ADU-PRD-01 §23.1. No element receives an Ethiopic-only family, including elements whose visible content is entirely Ge'ez.

**INVARIANT — no missing-glyph box (`□`) appears anywhere in either locale.** The check: on any Amharic page, the wordmark, both platform names and at least one figure must render as characters.

This already cost one wireframe round. An Ethiopic-only family renders `ADULIS`, `TikTok`, `Instagram` and **every digit** as boxes — and because the Ge'ez itself looks correct, a reviewer who does not read Amharic will not notice.

### 8.3 Translation status

⚠ **The Amharic strings currently in the site are machine output and are not approved.** They were carried from the wireframes to keep the layout testable.

**INVARIANT — a key missing from the Amharic catalogue falls back to English**, never to a raw key path. This is what lets translation proceed key by key without breaking pages.

**INVARIANT — translated strings are never assembled from concatenated fragments.** Each is a complete sentence with named slots; word order differs between the two languages.

**INVARIANT — every container assumes at least 40% text expansion over English.**

**Ge'ez layout validation is a launch gate** (ADU-PROJ-01 §12) and **cannot be performed against machine output**, because the string lengths are not trustworthy. Human translation is a prerequisite for the gate, not a follow-up to it.

---

## 9. Technical requirements

| Concern | Decision | Reason |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript | Server-rendered by default |
| Hosting | Cloudflare Pages + Workers | Zero egress; edge presence closer to Addis than any origin region; sits alongside the R2 decision already taken |
| i18n | `next-intl`, route-prefixed | §8.1 |
| Fonts | Inter + Noto Sans Ethiopic, each with its own `unicode-range` | §8.2, and English pages never download the Ethiopic file |
| Forms | Server actions, server-side validation, rate limited | §5.2 |
| Analytics | **Self-hosted only** | §12 |

**This does not settle product hosting** (ADU-PROJ-01 §10), which involves a stateful Postgres and different constraints.

**INVARIANT — no third-party analytics, tracking, advertising or session-recording script is loaded.** The site collects personal data from prospective sellers; adding a third party to that flow creates a processor relationship nobody has assessed.

### 9.1 Performance

The binding constraint is the same as the product's: **first paint on a low-end Android over a slow connection.**

- Server-rendered; no client-side data fetching on any Tier 1 page
- The Ethiopic font file must **not** be requested on `/en` routes
- No page depends on JavaScript to render its content

---

## 10. Accessibility

**Target: WCAG 2.1 AA on every route, in both locales.**

**INVARIANT — visible keyboard focus on every interactive element**, never removed without replacement.

**INVARIANT — a skip link precedes the header.**

**INVARIANT — minimum 44×44px touch targets.**

**INVARIANT — `prefers-reduced-motion` is respected.**

Every form field has a visible label above it. Placeholder text is never the label.

---

## 11. Undecided — flag, never invent

**INVARIANT — an undecided item renders as a visibly flagged placeholder.** It is never filled with plausible content, because plausible content ships unnoticed.

| Item | Blocks |
|---|---|
| **Domain and all email addresses** | Contact page · site URL · App Links domain association |
| **Legal body text** — Terms, Privacy, Seller Terms, Refunds & Disputes | Tier 2 completion · app-store submission |
| **Report Content reason categories** | W21 completion |
| **Company registration number** | About page |
| **Trust ladder thresholds** | Nothing — the site states they are undecided, which is correct |
| **Founder photographs and category imagery** | Visual completion |
| **Amharic translation** | Ge'ez layout validation gate |
| **Launch date** | Nothing — never published |

Two exceptions where content **is** fixed and must be exact:

- Privacy **§2** and **§9** both state: *"Waitlist data is kept for up to 12 months."*
- Privacy **§4** states: *"Adulis never stores identity photographs."*

---

## 12. Measurement

**INVARIANT — site events follow the versioned naming convention in ADU-PRD-01 §20**, so website and product events sit in one schema.

| Event | Answers |
|---|---|
| `waitlist_form_viewed` | Does the pitch above the form get read? |
| `waitlist_field_abandoned` | Which field loses applicants |
| `waitlist_submitted` | The only conversion |
| `waitlist_validation_failed` | Whether the form fights people |
| `buyer_door_clicked` | Whether the seller/buyer split is right |
| `seller_door_clicked` | The reverse |
| `language_switched` | Real Amharic demand, measured rather than assumed |
| `deletion_requested` · `deletion_blocked` | Store-facing volume |

**`language_switched` matters more than it looks.** Whether Amharic is a courtesy or a requirement is currently an assumption. This is the only instrument that answers it.

---

## 13. Launch gates

The site is finished when all of these hold.

| Gate | Evidence |
|---|---|
| **Every route resolves** in both locales, with no stub remaining | Manual walk of all 16 |
| **No missing-glyph box anywhere** | §8.2 check on every Amharic page |
| **Amharic is human-translated** and every layout validated in Ge'ez with realistic strings | §8.3 |
| **360px pass** — every page complete, no horizontal scroll | Manual, on a real low-end device |
| **Forms work with JavaScript disabled** and validate server-side | Manual |
| **WCAG 2.1 AA** on every route, both locales | axe or Lighthouse, recorded |
| **Terms, Privacy, Report content and Delete my account reachable from every page** | Automated link check |
| **Deletion page live and complete**, including the blocked branch | Required before either app store submission |
| **Retention figure agrees** in consent line, privacy notice and implementation | §7.3 |
| **DPIA covers waitlist data** | Before the first submission |
| **Contact mailboxes work** | Both stores and any investor will check |
| **No invariant in §3 violated** | Copy review against §3 |

**The deletion page and the DPIA are the two hard external gates.** Everything else is quality; those two block an app-store submission and a regulatory obligation respectively.

---

## 14. Open items

| Item | Blocks | Owner |
|---|---|---|
| **Domain** | Email addresses · site URL · App Links · store listings | CEO |
| **Amharic translation** — replace machine output wholesale | Ge'ez validation gate | CMO |
| **Legal text** for four pages | Tier 2 · app-store submission | CEO |
| **Report Content reason categories** | W21 | CEO |
| **Waitlist delivery destination** — where submissions land and who reviews them | First submission | CEO |
| **Chatbot copy correction** on For Sellers (§3.4) | Accuracy of the seller pitch | CEO |
| **Buyer-side rebalance when the apps ship** — how much prominence the buyer door gains | Post-launch | CEO |
| **Whether storefronts share this codebase or a separate one** | Storefront build (ADU-PRD-01 §3.1) | COO/CTO |

---

## 15. Website doctrine

1. **The waitlist is the only conversion.** Nothing competes with it.
2. **Every claim is one Adulis can stand behind.** If the product cannot do it, the site does not say it.
3. **State the limits.** The blocks explaining what Adulis does *not* do earn more trust than the feature lists above them, and they are not optional.
4. **Flag, never invent.** An undecided item is visible. Plausible filler ships unnoticed.
5. **Amharic is not a translation pass.** It is a layout constraint from the first frame, and machine output cannot satisfy it.
6. **Mobile is the product's audience.** Desktop is for investors and press. Both matter, in that order.
7. **Nothing on this site requires JavaScript to be understood.**

---

*Binding specification for the public website. Legal text, data-protection review and translation remain open.*
