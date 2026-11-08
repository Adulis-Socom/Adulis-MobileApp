# WO-001B - Foundation consolidation and November design-authority sync

Status: complete, pushed, awaiting founder review. Branch
`mobile/wo-001b-foundation-design-sync`. No pull request, no merge, `main` untouched.
WO-001C and WO-002 not started.

This work order changes documents and agent instructions only. No product feature was
built. No API, backend, database, contract, package or app code changed.

## 1. Starting point

| | SHA |
|---|---|
| `origin/main` at start (after `git fetch origin`) | `01302cfb7616cb38de111de9a7694312c58c8913` |
| `mobile/wo-001-foundation` | `062aa740874cd3105dc0079200d976884bfd6502` (local = origin) |
| `mobile/wo-001a-locale` | `1adacb0c824a659e3484a9fc0a75968d425f513e` (local = origin) |
| `mobile/wo-001a-native-closure` | `eac58b114aa56e35ea5bb3d6120667b1003f35c8` (local = origin) |

All three heads matched the work order exactly.

## 2. Ancestry, and what was integrated

`git merge-base --is-ancestor` holds at every step: main <= WO-001 <= WO-001A locale <=
WO-001A native closure, and `merge-base(main, native-closure)` is `main` itself. The stack
contains no merge commits. `mobile/wo-001a-native-closure` therefore already contains all
accepted work, so it was the only branch integrated.

The integration branch was created from `origin/main` (`--no-track`, so it does not track
`main`) and fast-forwarded to `eac58b1`. The fast-forward preserves the accepted history
commit for commit, with no merge and no rewrite:

| Commit | |
|---|---|
| `062aa74` | WO-001: the Expo three-mode mobile foundation |
| `56b659f` | WO-001A (locale): the catalogue split by audience |
| `1adacb0` | WO-001A (locale): en.ts / am.ts keep the shared strings; catalogue.ts composes |
| `eac58b1` | WO-001A (mobile): com.adulis.app, the mobile-safe catalogue, first native build |

WO-001B adds three commits on top (section 9).

## 3. November pack verification

Source: `C:\Users\naods\Downloads\Adulis_Nov08_Reconciled_System_Designs_FIXED.zip`,
12,640,107 bytes, SHA-256
`f2dd1b3b9c820499fd844d14298e5c585565b78d014646d999b818716ad518b7`. It was extracted into
an empty scratch directory outside the repository. The founder's own extraction in
Downloads was not used.

| Check | Result |
|---|---|
| Archive extracts | PASS (unzip exit 0; 346 files) |
| Pack checksums | PASS: `SHA256SUMS.txt` lists 345 files, all 345 OK, none missing or extra |
| 34 complete designs | PASS: 34 Markdown, 34 JSON, 34 PDF. ADU-OPS-01 is one design in two volumes, and the Canonical Knowledge Base counts as one of the 34 |
| Markdown complete | PASS, all 34: each version header matches `DOCUMENT_VALIDATION.json`; every file has exactly one more `##` heading than its recorded section count (the "Document control" heading); and the "Post-October-13 reconciliation - current authority" section appears in exactly the 24 designs marked UPDATED, and in none of the 10 UNCHANGED |
| JSON parses | PASS (45 files, 0 errors) |
| Text integrity | PASS: no control bytes, no BOM; UTF-8 throughout |
| Required material | PASS: `README.md`, `Reports/POST_OCT13_RECONCILIATION_2026-11-08.md`, `Reports/CORRECTION_SUMMARY_2026-11-08.md`, `Reports/OPEN_DECISIONS_AND_RELEASE_GATES.md`, `Reports/AMENDMENT_REPORT.md`, plus validation (`VALIDATION_REPORT.md`, `november_pack_validation.json`, `DOCUMENT_VALIDATION.json`, contract/handoff validators), index (`FILE_INDEX.csv`, `CONTENTS.txt`, `SOURCE_TO_OUTPUT_MAP.csv`) and checksum (`SHA256SUMS.txt`) material |
| Pack self-validation | `november_pack_validation.json`: status PASS, 11/11 semantic checks true, contract and handoff validators PASS, `errors: []` |

The pack is complete and readable. The work order's STOP condition did not arise.

**One internal inconsistency, cosmetic.** `VALIDATION_REPORT.md` and
`DOCUMENT_VALIDATION.json` still point at paths from the original, non-portable edition
(`Historical_Evidence/October_13_Validation/`, `Editable_Sources/`, full-length
filenames). The FIXED edition does not contain those paths. `FILE_INDEX.csv` maps every
full filename to its short one, and the pack README says the October evidence is
deliberately left out.

## 4. Where the current designs were installed

The repository had no system-design location. Its `docs/` holds a separate document
family: ADU-00, PROJ-01, PRD-01, DB-01, API-01, AUTH-01, ARCH-01, REPO-01, CON-0x and
others. The October system designs were never installed. The pack was installed at:

```
docs/system-designs/README.md            repository-authored index (34 designs + versions)
docs/system-designs/2026-11-08/          verbatim subset of the archive, at its own paths
  Sources/Markdown/*.md                  the 34 complete designs
  Reports/*                              14 reconciliation / validation / index files
  Contract_Registry/*                    8 static contract fixtures the designs cite
  README.md REPAIR_REPORT.md CONTENTS.txt FILE_INDEX.csv SHA256SUMS.txt
```

All 60 installed files verify in place: `sha256sum -c --ignore-missing SHA256SUMS.txt`
reports 60 OK. A copy checked out from the git index verifies the same way.
`.gitattributes` marks the directory `-text`. Without it, `* text=auto eol=lf` would
rewrite the three CRLF CSVs on commit and break their checksums.

| Not committed (remains in the archive) | Reason |
|---|---|
| `PDFs/` (34, 6.4 MB) | rendered from the same sources |
| `Sources/JSON/` (34, 5.4 MB) | a second encoding of the same designs (the renderer input) |
| `Sources/Graphics/` (217 SVG, 25 MB) | renderer output with text drawn as glyph paths. The Markdown figure links (`graphics/*.svg`) do not resolve in the repository; each figure's caption stays in the Markdown |

No ZIP, PDF, temporary extraction directory or cache was committed.

## 5. Authority precedence

Recorded once, in `.claude/reference/DOCUMENT_AUTHORITY.md`, as the work order states it:

1. the founder's current explicit decisions (including accepted WO-001 / WO-001A decisions);
2. the November 8 2026 reconciled system-design pack (within each updated design, its
   post-October-13 reconciliation section wins);
3. the pack's November reconciliation and open-decision reports;
4. the approved prototype (`dev` @ `f448d06`), for UX and presentation only;
5. older October and repository documentation.

The pack's own `POST_OCT13_RECONCILIATION` states the same order, phrased for its own
contents.

Versions are the ones the pack states. Those most relevant to Mobile are ADU-MOB-02
v4.3, ADU-AUTH-02 v3.3, ADU-ARCH-PLATFORM-01 v3.3 and ADULIS-KB v3.3. All 34 are listed
in `docs/system-designs/README.md`.

## 6. Old-document treatment

- **The repository specifications stay where they are.** Nothing was moved, deleted or
  rewritten. Several are parsed by gates (`verify:permission-doc`,
  `verify:transcription`, `appendix`, `deferred-values`, `surface-markers`,
  `docs-ascii`). ADU-DB-01 v1.19, ADU-API-01 v1.11 and `contracts/openapi.json` describe
  what is built.
- **They no longer look current for design intent.** `docs/amendments/README.md` now
  opens with the November pack as current authority. Its version table is renamed
  "Repository specifications: current versions, all installed". `DOCUMENT_AUTHORITY.md`
  calls the same list "Repository specification set (position 5 above)".
- **A disagreement between the pack and the repository is `SPEC_CONFLICT`**: report it
  and change neither side without a founder work order.
- **ADU-DPIA-01 is one ID on two lineages.** The repository's v1.0 has a 24 August
  baseline. The pack's v1.1 descends from a v1.0 reviewed on 8 October and says
  "supersedes none". The repository copy was therefore not moved to `superseded/`, and
  the CON-02 v3.0 gap list's "ADU-DPIA-01 -> v1.1" is **not** shown to be discharged by
  the pack's v1.1.
- **The October 13 baseline was never installed here**, so there is nothing in the
  repository to retire. The pack carries no October copies.

## 7. Files changed

| File | Change |
|---|---|
| `docs/system-designs/2026-11-08/**` (61 files) | new: the verbatim pack subset |
| `docs/system-designs/README.md` | new: index, install record, verification |
| `.gitattributes` | `docs/system-designs/2026-11-08/** -text` |
| `.claude/reference/DOCUMENT_AUTHORITY.md` | precedence; the conflict register K-1 to K-7; position 5 explained; the authority-by-question list points to the pack first |
| `.claude/reference/STACK_BASELINE.md` | marked as what is built; conflict K-3 (BullMQ/Valkey); the full Mobile stack line |
| `CLAUDE.md` (root) | prime rule: the November pack is the current system-design authority; K-3 authorises nothing until ruled |
| `apps/mobile/CLAUDE.md` | system design (MOB-02 v4.3, AUTH-02 v3.3, ARCH-PLATFORM-01 v3.3, KB v3.3) placed above the implementation contract; R-23 retires the prototype's "Account model unresolved"; R-19 Amharic user gate; R-20 on Courier; R-19 cited for the billing rule; prototype placed at UX and presentation only |
| `docs/amendments/README.md` | opening section names the pack as current authority |
| `.claude/skills/adulis-spec-router/SKILL.md` | the pack first; corrected filenames for the installed DB v1.19, API v1.11, AUTH v2.8 and CON-02 v3.2 (the old lines named files that exist nowhere, which made a Glob return `MISSING_SOURCE`); never let the prototype override the pack |
| `.claude/skills/adulis-seller-companion/SKILL.md` | MOB-02 v4.3 and AUTH-02 v3.3 added as governing sources; installed API/AUTH filenames; the K-1 banner blocks the Phase-1 payment items |
| `.claude/skills/adulis-seller-companion/EVALS.md`, `.claude/EVAL_CHECKLIST.md` | eval 5 now expects `SPEC_CONFLICT` K-1 |
| `docs/mobile/WO-001B-FOUNDATION-DESIGN-SYNC.md` | this record |

Every other `adulis-*` skill reads `DOCUMENT_AUTHORITY.md` first, so each one gets the
new precedence without an edit.

## 8. Accepted foundation: preserved

`git diff eac58b1 HEAD -- apps packages contracts db pnpm-lock.yaml package.json` changes
exactly one file, `apps/mobile/CLAUDE.md`.

| Check | Result |
|---|---|
| Android package / iOS bundle | `com.adulis.app` / `com.adulis.app` |
| Expo project | owner `naod61s-team`, slug `adulis`, projectId `f1b64f7b-6725-4415-9466-d7fa7756fdbd` (unchanged) |
| Locale entry | `@adulis/locale/mobile` is the app's only locale import; the guard passes |
| Shells | `src/app/buyer`, `seller`, `courier` behind `ModeLayout` |
| Courier | no `fetch`, query, mutation or API-client call under `src/app/courier` or `src/modes` |
| Product features | none added |
| Prototype | `dev` @ `f448d06b90f6cdafac0dcd48f9e70cfd2ce81d0e`, clean, not touched |

## 9. Validation

Node 22.19.0, pnpm 10.32.1, run at HEAD `ec0c48a` (both content commits in place):

| Command | Result |
|---|---|
| `pnpm --filter @adulis/mobile typecheck` | PASS |
| `pnpm --filter @adulis/mobile test` | PASS: locale-import guard, then 5 suites, 26/26 tests |
| `pnpm --filter @adulis/mobile build` | PASS (android and ios bundles in `dist/`) |
| `pnpm --filter @adulis/locale test` | PASS: catalogue type tests; `mobile.ts` reaches only `am.ts`, `en.ts`, `mobile.ts`; 100 shared strings, none with subscription vocabulary |
| Expo Doctor (`npx expo-doctor`) | PASS 20/20 (the first scripted run used `--no-install` and failed only because the CLI is not a local dependency; that was a mistake in the invocation, not a project issue) |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS |
| `pnpm verify:deps` | PASS: no violations (330 modules, 1538 dependencies) |
| `pnpm verify:docs` | PASS: permission doc 252/252 cells; the governed ASCII list is current and its 12 documents pass; the 34 pack designs are listed as carried non-ASCII debt (not enforced); NUL guard clean |
| `pnpm verify:mt-keys`, `pnpm verify:error-locale` | PASS |
| Bundle scan of `apps/mobile/dist` | 0 of 12 subscription/billing/purchase probes; the positive probes (`Some systems are unavailable`, `foundation ready`) are present in both bundles |

**Not run:** the repository-wide `pnpm test`. It is not in this work order's list, and no
API, database or package code changed. The known pre-existing backend failures recorded
in WO-001A were neither touched nor re-measured.

Commits:

| Commit | |
|---|---|
| `f7919d6` | install the November 8 2026 reconciled system-design pack |
| `ec0c48a` | point the authority references at the November pack |
| this commit | this record |

## 10. Unresolved - for the founder

1. **Conflicts between the pack and the repository** (`DOCUMENT_AUTHORITY.md`, K-1 to K-7).
   These were found while installing the pack, not by a full audit; the contract
   readiness audit owns the complete comparison.
   - **K-1 payment model (largest).** The pack makes Chapa gateway checkout and
     provider/backend verification the payment authority, with no manual bank-transfer
     fallback and no Seller payment confirmation (R-12). PRD v8.5, the built backend
     and the console implement manual transfer confirmed by the seller.
   - **K-2 discovery scope.** The pack makes the Scene-only algorithmic FYP current.
     PRD v8.5 defers discovery and ranking to V3.
   - **K-3 background engine.** The pack specifies BullMQ on Valkey ("no Graphile
     Worker"). The backend runs graphile-worker, and the root rules reject Redis without
     a reissued architecture decision.
   - **K-4 Courier audience** (R-20) and **K-5 mode eligibility and generated client
     types** (R-21): contract corrections owed.
   - **K-6 same subject, different lineage**: AUTH-02 / AUTH-01, CONSOLE-02 / CON-02,
     CSP-01 / SEC-01, WEB-02 / WEB-01, and DPIA-01 on two lineages.
   - **K-7 encoding**: the pack is UTF-8; A3.5 asks for ASCII. Are ASCII copies owed?
2. **The workspace `CLAUDE.md`** (`Adulis-Mobile-Workspace/`, outside every repository,
   so not edited) still calls `apps/mobile` a placeholder. It also keeps the "STALE -
   requires reconciliation" two-mode block that WO-001 resolved, and it does not name the
   November pack. Sessions start there, so it is the first file an agent reads.
3. **Amharic user gate (R-19).** The foundation screen's language choice is visible in
   every build. It must be gated before any user release.
4. **The Seller Companion skill's other Phase-1 items** (notifications, inbox, mode
   switcher, the non-payment order-detail actions) have not been checked against
   ADU-MOB-02 v4.3. Only the payment conflict is marked.
5. **The other `adulis-*` skills** still list pre-installation filenames, such as CON-02
   v3.0 and API-01 v1.3. They read `DOCUMENT_AUTHORITY.md` first, so they get the
   precedence. Their own lists are older debt, not mobile, and were not edited.
6. **The pack's figure links** (`graphics/*.svg`) do not resolve in the repository (the
   SVGs were not installed; section 4).
7. **`G:\wo001a`** (the WO-001A native-build copy) still exists on disk, though it is no
   longer a registered worktree. Deleting it is a founder action.
8. **Open in the pack itself, deliberately not closed**
   (`OPEN_DECISIONS_AND_RELEASE_GATES.md`): the final brand palette, the Seller Stories
   production contract, the Courier MOBILE executable contract, the generated
   API-client exports, human Amharic translation, repository-health debt, the 44 vs 48
   dp touch target, and the native-build workstation path.
