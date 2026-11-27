# SC-FE-04 / 05 / 05S / 06 -- provisional decisions made without a governing requirement

Console session, 26 November 2026. ASCII only. These are PROPOSALS, not product rules (same status as SC-FE-01-03-PROPOSALS.md): each
fills a gap the governing designs leave open so a screen could be built and tested. Every one is named so the backend work orders (SC-BE-*)
and the founder can confirm, change or reject it. None is written into `contracts/openapi.json`.

| ID | Proposal | Why it was needed | Where |
|---|---|---|---|
| P-30 | The fixture taxonomy is a DEMONSTRATION: every non-major node is labelled "Demonstration category", ids carry `fx_`, and every `required` flag is arbitrary. Cosmetics and Electronics have no defined attributes on purpose | the submitted workbooks establish no required / searchable / filterable / Variant-defining rule (reports 16) | fixtures/catalogue.ts |
| P-31 | A category carries `definition_status` (DEFINED, ATTRIBUTES_NOT_DEFINED, NOT_DEFINED); an undefined category is a visible notice, never an empty form, and a Variant is then a single default | "all category-specific acceptance gaps must remain visible"; the generic editor must not be blocked | contracts/gap-sc-catalogue.ts |
| P-32 | Every resource carries `allowed_actions` resolved by the server; the Console shows a control only when the server lists it | CONSOLE-02 rule: the Console computes no business state | all GAP-SC-08..14 |
| P-33 | `CONFLICT` is a problem code; every editable resource carries a version token, a stale write is refused and the Seller is offered a reload | CATINV S119, S118 STOCK_VERSION_CONFLICT; no problem code existed for it | transport/port.ts |
| P-34 | Image upload is collapsed to one call; fixtures send no bytes (name and type only) | the real flow is grant, direct upload, bind (CON S55-S56); not buildable without storage | gap-sc-catalogue.ts |
| P-35 | Stock confidence is state + reason + effect codes rendered through the catalogue; the effect code `NONE_DEFINED` says no effect has been defined | CON S54 asks for "what effect it currently has" and no design defines one | catalogue.ts |
| P-36 | Demonstration values, all the server's to set in reality: low-stock threshold 3, confidence window 7 days, media processing 1.5 s, list page sizes 6 (Products) and 5 (Scenes) | CATINV S67 and S53 leave them to configuration | fixtures |
| P-37 | A Scene's visibility and Private reason are RESOLVED on every read from live Product facts; the fixture emits ALL_TAGGED_PRODUCTS_OUT_OF_STOCK when a tagged Product is still eligible and ALL_TAGGED_PRODUCTS_UNAVAILABLE when none is. The Console shows the one sentence CON quotes for the stock reason and an honest neutral line otherwise | report 17 C-2 (the two names differ in breadth) | fixtures/content.ts |
| P-38 | Zero-tag blocker is `PRODUCT_TAG_REQUIRED` in the fixture, with copy for both names | report 17 C-1 (identical semantics) | fixtures/content.ts, locale |
| P-39 | Hotspots work three ways: pointer, keyboard (Enter at centre, arrows 1 percent, Shift 5, Delete) and number fields | SCN S24: an overlay may never be the only way | features/content |
| P-40 | A Story link is eligible when a Product is published AND still available, or a Scene is public; a link that stops being eligible suppresses the Story (fail closed). The 24 hours is authored by the fixture server; a fixture-only clock-skew hook tests the lifetime | STORY contract: "fail closed" on a now-ineligible link; no way to wait 24 hours in a test | fixtures/content.ts |
| P-41 | Fixture readiness rules: a Store profile is complete when name and bio are set; fulfilment is configured when a method is on, with a service area when it is a delivery method | readiness items follow real data instead of stored flags; the rules are not in any design | fixtures/store.ts |
| P-42 | Courier invitation is by phone number with one answer for every number; no per-relationship compensation, no applications | B02B-D02 retains invitations, status, relationships, revoke only (report 17 C-3 S-1, S-2) | fixtures/store.ts |
| P-43 | Inventory holds `catalogue.write` and `inventory.write` (and so may edit, publish and withdraw Products); Campaign Manager holds `content.write` only | CATINV S110 reading: Inventory is "primary authorized Product/Variant/availability/stock and permitted price/media/publication work" | fixtures/world.ts |
| P-44 | The hygiene rule on console copy is refined: Orders and payments are never named anywhere; "delivery" may be named only in `fulfilment.*`, `couriers.*`, `courier.*` and one coverage message, where the designs name the three fulfilment modes and Courier relationships; copy there may never claim a live delivery | the three governing mode names contain the word | hygiene.test.ts |
| P-45 | A save announces "Saved." through a polite status region (opt-in per form) | assistive technology had no confirmation of a successful save | features/shared |
| P-46 | All proposed English copy for these screens is proposed wording awaiting approval; Amharic is PENDING and unpublished | brief S7; almost no copy is governed verbatim (report locale_requirements) | packages/locale |

Verbatim from the designs (not proposals): "Update stock", "Confirm stock is accurate" (CON S53); Not Available / Low / Available (CATINV S66);
the content-list tabs including "Restricted / Removed" (CON S59); the moderation state names (CON S68); "All tagged Products are currently out of
stock." (CON S59, S121); the three fulfilment mode names Buyer Collection, Seller Delivery and Courier Delivery (FUL-01 S1).

Batch 02C: P-30 to P-46 is 17 proposals (not 46). Dispositions, the Private-reason and Courier rulings and proposals P-47 to P-54 are in SC-FE-04-06-CLOSURE-DECISIONS.md.
