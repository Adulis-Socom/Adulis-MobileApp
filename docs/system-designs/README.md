# System designs - current authority

**Current pack: the November 8 2026 reconciled system-design pack, in
[`2026-11-08/`](2026-11-08/).** By founder decision (WO-001B) it is the current
system-design authority for every domain it covers, and it outranks the older
repository specifications in `docs/` for design intent. Precedence, and the
conflicts between this pack and what is built, are kept in ONE place:
[`.claude/reference/DOCUMENT_AUTHORITY.md`](../../.claude/reference/DOCUMENT_AUTHORITY.md).

This file is the index. It does not restate rules.

## How to read a design

1. Every design is a complete document, not a delta.
2. In the 24 UPDATED designs, the final section **"Post-October-13
   reconciliation - current authority"** wins over any earlier passage of that
   same design for the topics it lists. The rest of the body keeps its 13
   October meaning.
3. The cross-pack change register is
   [`Reports/POST_OCT13_RECONCILIATION_2026-11-08.md`](2026-11-08/Reports/POST_OCT13_RECONCILIATION_2026-11-08.md)
   (R-01 to R-23). What the pack deliberately leaves open is
   [`Reports/OPEN_DECISIONS_AND_RELEASE_GATES.md`](2026-11-08/Reports/OPEN_DECISIONS_AND_RELEASE_GATES.md):
   do not close an item on that list in code.
4. Internal canonical names (Product Post, Scene Post) may appear in design
   prose; Buyer-facing copy says Product and Scene (R-01).

## The 34 designs

Versions are the ones the pack states, taken from its `FILE_INDEX.csv` and
`Reports/DOCUMENT_VALIDATION.json`. ADU-OPS-01 is one design in two volumes, and
the Canonical Knowledge Base counts as one of the 34.

| Design | Title | Version | Since 13 Oct |
|---|---|---|---|
| [ADU-ANL-01_v3.3](2026-11-08/Sources/Markdown/ADU-ANL-01_v3.3.md) | Adulis Analytics and Attribution | 3.3 | updated |
| [ADU-ARCH-PLATFORM-01_v3.3](2026-11-08/Sources/Markdown/ADU-ARCH-PLATFORM-01_v3.3.md) | Adulis Platform Integration | 3.3 | updated |
| [ADU-AUTH-02_v3.3](2026-11-08/Sources/Markdown/ADU-AUTH-02_v3.3.md) | Adulis Authentication and Authorization | 3.3 | updated |
| [ADU-CATINV-01_v3.3](2026-11-08/Sources/Markdown/ADU-CATINV-01_v3.3.md) | Adulis Catalogue and Inventory | 3.3 | updated |
| [ADU-CHAT-01_v3.3](2026-11-08/Sources/Markdown/ADU-CHAT-01_v3.3.md) | Adulis Buyer-Seller Chat | 3.3 | updated |
| [ADU-CHATBOT-01_v3.3](2026-11-08/Sources/Markdown/ADU-CHATBOT-01_v3.3.md) | Adulis Chatbot and NLU Engine | 3.3 | updated |
| [ADU-CLAIM-01_v3.2](2026-11-08/Sources/Markdown/ADU-CLAIM-01_v3.2.md) | Adulis Claims, Disputes and Evidence | 3.2 | unchanged |
| [ADU-CONSOLE-02_v4.3](2026-11-08/Sources/Markdown/ADU-CONSOLE-02_v4.3.md) | Adulis Seller Console | 4.3 | updated |
| [ADU-CSP-01_v1.1](2026-11-08/Sources/Markdown/ADU-CSP-01_v1.1.md) | Adulis Content Security Policy | 1.1 | unchanged |
| [ADU-DEPLOY-01_v3.2](2026-11-08/Sources/Markdown/ADU-DEPLOY-01_v3.2.md) | Adulis Deployment Architecture | 3.2 | updated |
| [ADU-DPIA-01_v1.1](2026-11-08/Sources/Markdown/ADU-DPIA-01_v1.1.md) | Adulis Data Protection Impact Assessment | 1.1 | unchanged |
| [ADU-EVT-01_v3.2](2026-11-08/Sources/Markdown/ADU-EVT-01_v3.2.md) | Adulis Eventing and Background Jobs | 3.2 | unchanged |
| [ADU-FIN-01_v3.3](2026-11-08/Sources/Markdown/ADU-FIN-01_v3.3.md) | Adulis Payments, Payouts and Financial Evidence | 3.3 | updated |
| [ADU-FUL-01_v3.3](2026-11-08/Sources/Markdown/ADU-FUL-01_v3.3.md) | Adulis Fulfilment and Courier Assignment | 3.3 | updated |
| [ADU-HND-01_v3.2](2026-11-08/Sources/Markdown/ADU-HND-01_v3.2.md) | Adulis Handoff Verification | 3.2 | unchanged |
| [ADU-MEDIA-01_v3.1](2026-11-08/Sources/Markdown/ADU-MEDIA-01_v3.1.md) | Adulis Media Management and Processing | 3.1 | unchanged |
| [ADU-MKT-01_v3.3](2026-11-08/Sources/Markdown/ADU-MKT-01_v3.3.md) | Adulis Market Configuration and Localization | 3.3 | updated |
| [ADU-MOB-02_v4.3](2026-11-08/Sources/Markdown/ADU-MOB-02_v4.3.md) | Adulis Mobile App | 4.3 | updated |
| [ADU-MOD-01_v3.3](2026-11-08/Sources/Markdown/ADU-MOD-01_v3.3.md) | Adulis Moderation and Abuse | 3.3 | updated |
| [ADU-NOTIF-01_v3.3](2026-11-08/Sources/Markdown/ADU-NOTIF-01_v3.3.md) | Adulis Notifications | 3.3 | updated |
| [ADU-OBS-01_v3.2](2026-11-08/Sources/Markdown/ADU-OBS-01_v3.2.md) | Adulis Observability and Reliability | 3.2 | unchanged |
| [ADU-ONB-01_v3.2](2026-11-08/Sources/Markdown/ADU-ONB-01_v3.2.md) | Adulis Seller Onboarding | 3.2 | unchanged |
| [ADU-OPS-01_v3.1_Founder](2026-11-08/Sources/Markdown/ADU-OPS-01_v3.1_Founder.md) | Adulis Operator Console - Founder Operations | 3.1 | unchanged |
| [ADU-OPS-01_v3.1_Staff](2026-11-08/Sources/Markdown/ADU-OPS-01_v3.1_Staff.md) | Adulis Operator Console - Staff Operations | 3.1 | unchanged |
| [ADU-ORDER-01_v3.3](2026-11-08/Sources/Markdown/ADU-ORDER-01_v3.3.md) | Adulis Order Management and Checkout | 3.3 | updated |
| [ADU-PRV-01_v3.3](2026-11-08/Sources/Markdown/ADU-PRV-01_v3.3.md) | Adulis Privacy and Data Lifecycle | 3.3 | updated |
| [ADU-REC-01_v3.2](2026-11-08/Sources/Markdown/ADU-REC-01_v3.2.md) | Adulis FYP and Recommendation Engine | 3.2 | updated |
| [ADU-REV-01_v3.3](2026-11-08/Sources/Markdown/ADU-REV-01_v3.3.md) | Adulis Reviews and Ratings | 3.3 | updated |
| [ADU-SCN-01_v3.2](2026-11-08/Sources/Markdown/ADU-SCN-01_v3.2.md) | Adulis Scene Posts and Content Lifecycle | 3.2 | updated |
| [ADU-SRC-01_v3.2](2026-11-08/Sources/Markdown/ADU-SRC-01_v3.2.md) | Adulis Search and Collections | 3.2 | updated |
| [ADU-STOREFRONT-02_v4.2](2026-11-08/Sources/Markdown/ADU-STOREFRONT-02_v4.2.md) | Adulis Seller Storefront | 4.2 | updated |
| [ADU-TRUST-01_v3.3](2026-11-08/Sources/Markdown/ADU-TRUST-01_v3.3.md) | Adulis Trust Ladder and Reputation | 3.3 | updated |
| [ADU-WEB-02_v4.2](2026-11-08/Sources/Markdown/ADU-WEB-02_v4.2.md) | Adulis Company Website | 4.2 | updated |
| [ADULIS-KB_v3.3](2026-11-08/Sources/Markdown/ADULIS-KB_v3.3.md) | Adulis Canonical Knowledge Base | 3.3 | updated |

`FILE_INDEX.csv` maps each short filename to the original full filename and
title.

**Same ID, different document.** The pack's ADU-DPIA-01 v1.1 is not a revision
of `docs/ADU-DPIA-01_Data_Protection_Impact_Assessment_v1_0.md`. Its own v1.0
was reviewed 8 October 2026, it says "supersedes none", and the repository's
v1.0 is a separate draft with a 24 August 2026 baseline. Read the pack's design
as the current one.

## What is installed, and what is not

`2026-11-08/` is a verbatim subset of `Adulis_Nov08_Reconciled_System_Designs_FIXED.zip`
(SHA-256 `f2dd1b3b9c820499fd844d14298e5c585565b78d014646d999b818716ad518b7`), at
the archive's own relative paths:

| Installed | |
|---|---|
| `Sources/Markdown/` | the 34 complete Markdown designs |
| `Reports/` | reconciliation, correction, open-decision, amendment, repair and validation reports, with their JSON/CSV indexes |
| `Contract_Registry/` | the static contract fixtures the designs cite (event registry and schemas, Seller permissions, the Handoff schema reference). These are specification fixtures. Nothing builds, runs or imports them |
| `README.md`, `REPAIR_REPORT.md`, `CONTENTS.txt`, `FILE_INDEX.csv`, `SHA256SUMS.txt` | the pack's own index and checksum material |

| Not installed (still in the archive) | Why |
|---|---|
| `PDFs/` (34) | rendered from the same sources |
| `Sources/JSON/` (34) | a second encoding of the same designs (the renderer input) |
| `Sources/Graphics/` (217 SVG, 25 MB) | renderer output with text drawn as glyph paths. The Markdown figure links (`graphics/*.svg`) therefore do not resolve here, but every figure keeps its caption in the Markdown |

**Verify the installed files against the pack's own checksums** (from
`2026-11-08/`):

```
sha256sum -c --ignore-missing SHA256SUMS.txt     # 60 files OK; the omitted ones are skipped
```

`.gitattributes` marks this directory `-text`. Without that rule, the
repository's `eol=lf` would rewrite the three CRLF CSVs on commit and break
their checksums.

**Encoding.** The designs are UTF-8 and contain non-ASCII typography (curly
quotes, arrows). By founder decision (WO-001C) they are UTF-8 design authority.
Amendment A3.5's ASCII rule binds the repository's legacy executable
specifications, not this pack, and no ASCII duplicate is made. They were installed
byte-for-byte: an altered copy would no longer match `SHA256SUMS.txt`, and that
file is their integrity check. `pnpm verify:docs-ascii` still lists them as
"carried debt" only because its walk is recursive. Scoping that walk is recorded in
`docs/mobile/WO-001C-CONTRACT-READINESS.md`.

## History

The 13 October 2026 baseline this pack reconciles was never installed in this
repository. It remains recoverable from the founder's archive. A future pack
gets its own dated directory beside this one, and this index then moves the
older pack into a "superseded" note rather than deleting it.
