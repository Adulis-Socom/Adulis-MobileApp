# WO-010 -- Founder Handoff

Catalogue Category Taxonomy and Buyer Category Discovery, with the external SSD environment and the
Collections session correction. 11 November 2026.

## Result

COMPLETE for the approved scope:
- the three top-level categories with stable identities and Market availability;
- Product classification validated by the database;
- server-side Shop and Search category filtering;
- the ON-112 correction;
- the SSD environment;
- every gate except Expo Doctor (19/20, upstream patch drift);
- the Android native flows.

**iOS was not tested.**

## Branch and commits

`mobile/wo-010-catalogue-categories`, from `0f909744d38c696eec7f61d659e03f76d84c7494` (WO-009A HEAD).
Code and tests end at `13c4a91`; this handoff, the two other records and the register are the next
commit, and the pushed HEAD is in the final report.

| Commit | Change |
|---|---|
| `5425f64` | locale: category labels and Shop strings (packages/locale, own commit) |
| `8aa77a0` | db: migration 0062 |
| `6ca51a1` | docs(db): ADU-DB-01 v1.27 |
| `d4a6d25` | api: Market-scoped categories, Shop and Search filters, tests |
| `f8208fa` | ops: seed and activation runbook (launch categories) |
| `708dedf` | contract: OpenAPI regenerated |
| `9f8c14c` | api-client: types regenerated (packages/api-client, own commit) |
| `ef9f28c` | mobile: Collections screens bound to the session (ON-112) |
| `1b69209` | mobile: Shop and Search category discovery |
| `b83ac5e` | dev: SSD environment script, storage audit update |
| `13c4a91` | dev: storage policy (SSD), CLAUDE.md |

## What to read

- `WO-010-CATALOGUE-CATEGORIES.md`: database, availability, API, security, tests.
- `WO-010-BUYER-CATEGORY-DISCOVERY.md`: Mobile UX, ON-112, tests, native validation.
- `../engineering/WO-010-SSD-ENVIRONMENT.md`: the SSD, configuration, checkpoints A-D, the page-file finding, cleanup.

## Decisions and actions for the founder

1. **Enable the launch categories in the Addis Ababa Market** (ON-20261111-115). Run
   `ops/runbooks/activate-market.md` Step 6 with that Market's code; the repository does not record
   it. Until then the launch Market lists no categories (the Shop shows All only).
2. **ADU-API-01 amendment for `GET /v1/categories`** (ON-114). The endpoint had no documented
   semantics; WO-010 made its rows Market-scoped and labelled, with additive fields.
3. **A Seller's store category** (ON-116). `core.seller.category_id` has no foreign key or Market
   check. Decide whether it uses this taxonomy.
4. **Category scope not approved** (ON-049, still open): subcategories, attribute definitions,
   classification of existing Products, Locally Made / Discounts / New Drops membership.
5. **Storage candidates** (ON-111, unchanged): pip leftovers 2.08 GB, the Docker build cache, `G:\wo001a`,
   the G: archive. Optionally, an NTFS partition or a shared cache folder for development on the
   SSD (ON-118).
6. **Unchanged and still pending:** ON-087, ON-088, ON-090, ON-091 (Collections policies); ON-079
   (Search launch settings, provisional); ON-080 (Search analytics, deferred); payment architecture.
   Production For You stays disabled.

## Key findings

- **The page-file question.** WO-009A's "unattributed" 13.3 GB on C: was the long-running Android
  emulator:
  - Stopping it returned 10.6 GB: 3.9 GB of page file, plus 6.7 GB of hidden temporary storage.
  - Started with its temp on the SSD, it costs 12.8 MB of C:.
  - The page file did not grow during WO-010.
- **Unattributed C: use outside Adulis.** During WO-010, other software used 3.1 GB of C: (A to D)
  outside every Adulis location. A game held about 10 GB of private memory (ON-120).
- **exFAT clusters.** The SSD is exFAT with 1 MiB clusters. Small-file caches cost about 1 MiB per
  file: 9,038 files took about 9 GB (ON-118).
- **Expo Doctor.** 19/20, because Expo published SDK 58 patch releases this evening (ON-117). No
  dependency was changed or silently upgraded.

## Recommended next Mobile work order

Buyer account controls (ADU-PRV-01 R-11: Edit Profile, Appearance, Delete Account on the existing
deletion function). Alternatively, once the founder approves the scope, Category structured
attributes and subcategories (ON-049). A small dependency-maintenance work order should first take
the Expo SDK 58 patches (ON-117) with a native rebuild check.
