---
name: adulis-unmechanized-invariants
description: >-
  The mobile-workstream rulings that no gate, test or lint checks -- the last row of ADU-MOB-06 S8 -- with, for each, its source document and section and what a reviewer must open and look at. Use during the adversarial pass on any change under apps/mobile, and whenever a screen, copy, toast, price-bearing component or release procedure is touched. It lists where to look; the rule itself lives only in the cited section.
allowed-tools: Read Glob Grep
metadata:
  owner: "CEO -- mobile workstream"
  version: "1.0.0"
  source: "ADU-MOB-06 v1.0 S8 (last row), S14 Q2; ADU-MOB-WO-01 v1.2 S0b.2"
---

# Unmechanised invariants -- what a person has to look at

ADU-MOB-06 S8: "a ruling with no mechanical check is recorded as a promise, not as a
control." These are the promises. **This file cites; it does not restate** (ADU-REPO-01 S6).
For each: open the section, then look at what the fourth column names. If the section and
this file ever disagree, the section wins and this file is corrected.

| Invariant | Source | Section | What a reviewer must look at |
|---|---|---|---|
| M2 | ADU-MOB-02 v1.0 | S3.5 | Every state a Buyer Mode screen implements, against S3's closed vocabulary; the error mapper's branches for `PERMISSION_DENIED`, `STEP_UP_REQUIRED` and `TIER_LIMIT_REACHED`, and the catalogue entries they render |
| M7 | ADU-MOB-02 v1.0; ADU-MOB-03 v1.0 | MB-14; S4.3 | The component the new-seller disclosure is rendered with, the controls on it, and where its event is emitted in the component lifecycle |
| M9 | ADU-MOB-02 v1.0; ADU-MOB-03 v1.0 | MB-17; S4.4 | Every clipboard call in the tree (`Clipboard.setString`, `setStringAsync`) and the handler it sits in; what MB-17 holds in memory versus any store |
| M11 | ADU-MOB-02 v1.0 | MB-32 | The rendered order and styles of the account screen's items, measured on the largest OS text size |
| M12 | ADU-MOB-02 v1.0; ADU-MOB-03 v1.0 | S4.4; S4.2 | Every `Countdown` render site: which variant it uses and what the order card shows at `PAYMENT_CONFIRMED` |
| D9 | ADU-MOB-03 v1.0 | S3.1 | Every `Toast` call site: what it carries and whether the buyer could have acted on it |
| D12 | ADU-MOB-03 v1.0 | S5 | Every import of `PriceBlock` and the feature directory it sits in; any new component whose name pairs a price with a tier, plan or subscription |
| B19 | ADU-MOB-01 v1.2 | S16.2 | Every control that opens a URL or the system browser, and where the URL lands; MB-39's copy |
| B21 | ADU-MOB-01 v1.2; ADU-MOB-07 v1.0 | S19.2; S4 | The change against ADU-MOB-07 S4's five questions before an over-the-air publish |
| T1 | ADU-MOB-06 v1.0; ADU-MOB-07 v1.0 | S3.1; S3, O3 | Where the publish ran from, which credential it used, and whether the runtime-version distribution moved as expected |

## Three of these are cheap to mechanise

ADU-MOB-06 S14 Q2 and ADU-MOB-PLAN-01 D21 name them: a lint rule on the clipboard (M9), a
lint rule on `PriceBlock`'s import paths (D12), and a snapshot test on MB-32's item adjacency
(M11). When one lands, move its row out of this table in the same PR -- a promise that has
become a control does not belong on a list of promises.

## Not on this list, on purpose

The fourteen grep gates (`apps/mobile/scripts/gates/run.mjs`), the unit and device tests of
ADU-MOB-06 S6-S7, and the counters of ADU-MOB-01 S20.3 are controls, not promises. They are
not restated here either; they are run.