# Adulis Media Management & Processing
Version 3.1 | 12 October 2026 | DOCUMENT-CORRECTED

## Document control

Complete amended baseline: 12 October 2026. The supplied correction prompt and owner decisions supersede the conflicting reviewed source wording. Every original numbered body section and unaffected table/graphic is retained; targeted contracts, examples, tests, invariants and dependent definitions are reconciled. The historical audit remains unchanged.

| Document control | Amendment baseline |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. |
| Source | ADU-MEDIA-01_Adulis_Media_Management_Processing_System_Design_v3.0.pdf |
| Authority | 19 selected corrections / F01-F18 and owner product decisions. |
| Status | DOCUMENT-CORRECTED; implementation, integration tests and external approvals not established. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |

## 1. Executive Architecture Decision

Adulis Media is an image-management system, not a general multimedia platform. The current release accepts and processes Seller image uploads for Product Posts and Scene Posts, creates bounded image derivatives, exposes safe delivery descriptors, preserves Scene/hotspot geometry, coordinates lifecycle and evidence holds, and supplies media to FYP, Storefront, Product detail, Moderation and Claims.

The previous native Product-video path is removed. Adulis has no current Seller video upload, server video parser pipeline, video transcoding, adaptive streaming, progressive native-video delivery or video-specific telemetry pipeline. If a Seller wants to include video, the only current path is an approved TikTok link attached to an eligible Product Post after ownership is verified through the Seller-linked TikTok account.

The TikTok video remains hosted by TikTok. Adulis stores only the provider-side identity and approval metadata needed to render the embed safely. Product commerce remains complete when the external video is unavailable.

Scene Content Lifecycle owns PUBLISHED + PUBLIC/PRIVATE visibility. Technical READY never grants public exposure. Media consumes current public-binding consequences for FYP, launch Scene Search and Storefront, retains held/canonical bytes during stock privacy, and reuses valid immutable derivatives on restoration.

## 2. Mission

The Media system exists to transform untrusted Seller image uploads into safe, efficient and lifecycle-aware Adulis media without allowing storage/CDN details to leak into Catalogue, Content, FYP or commerce logic.

It must make image-led product discovery fast enough for long FYP sessions, preserve visual product-tag geometry, keep public and restricted media access classes separate, and permit evidence retention or deletion without corrupting business history.

• Accept image uploads through scoped capabilities.

• Validate and normalize hostile input safely.

• Generate deterministic purpose-based derivatives.

• Deliver public bytes efficiently through Cloudflare CDN.

• Protect private evidence from public delivery paths.

• Keep Product/Scene business state outside Media.

• Support exact audit, retention and deletion semantics.

## 3. Current Product Context

Formal Seller publishing types are Product Post and Scene Post. Product images describe exact Products; Scene images support image-led discovery/merchandising with same-Seller Product tags and optional hotspots. Scene is the canonical object, not a second presentation type.

FYP top-level media units are image-based Scene Posts only. Marketplace Search launches with Product Posts, Sellers and PUBLIC Scene Posts. Media supplies bounded descriptors for eligible Search cards without indexing or ranking. Optional click-to-load TikTok remains Product-detail-only.

## 4. System Ownership Boundary

| Concern | Owner | Media responsibility |
| --- | --- | --- |
| Product identity / price / variants / stock | Catalogue + Inventory | Serve referenced image descriptors only |
| Scene Post caption / tags / revisions | Content Lifecycle | Serve image assets/presentations referenced by revision |
| FYP ranking / candidate ordering | Recommendation | Provide descriptors for Content-eligible Scenes; never decide visibility or rank |
| Public product/storefront rendering | Storefront read composition | Serve public derivatives through CDN |
| TikTok account + ownership status | Auth/Integration + Catalogue | Store/render only approved external embed metadata |
| Moderation decisions | Moderation | Apply distribution result; preserve held bytes where required |
| Claims evidence | Claims | Retain/restrict referenced media under hold |
| Media bytes / derivatives / technical state | Media | Canonical technical owner |

| Concern | Owner | Media integration |
| --- | --- | --- |
| Scene publication / PUBLIC-PRIVATE visibility | Content Lifecycle | Consume current binding/public eligibility; invalidate distribution without owning Scene state. |
| Marketplace Search retrieval / rank | Search | Supply bounded eligible Scene/Product/Seller-card descriptors; no Media search engine. |

## 5. What Media Owns

• UploadSession and short-lived upload grants.

• MediaAsset technical identity and state.

• Observed MIME, dimensions, size, integrity hash and normalized image metadata.

• Image normalization and Sharp processing version.

• Purpose-based image derivatives and immutable delivery keys.

• MediaPresentation crop/orientation/geometry metadata.

• Domain binding references and technical readiness.

• R2 object lifecycle, CDN delivery descriptors and purge/reconciliation.

• Media lifecycle state, holds integration and deletion execution.

• TikTok external-embed technical metadata required for safe rendering, but not TikTok business ownership policy.

## 6. What Media Does Not Own

• Product/Post publication state.

• Product price, inventory or purchase eligibility.

• Seller eligibility, Trust, platform admission or authentication evidence.

• Scene Post caption, Product tags or relevance policy.

• FYP candidate selection or ranking.

• Checkout, payment-provider or Order state.

• TikTok primary account-link authorization policy or business ownership decision.

• Moderation adjudication or Claims adjudication.

• User authentication, Seller team RBAC or Market assignment.

Media does not own Scene PUBLIC/PRIVATE visibility, Product tags, Marketplace Search ranking or Courier checkpoint-location evidence.

## 7. High-Level Topology

Seller Console requests a scoped image capability from Media API; normal bytes upload directly to private R2 staging. PostgreSQL/Drizzle stores canonical metadata; durable outbox/BullMQ jobs run bounded Sharp validation/normalization/derivatives.

READY images reach public descriptors only when the current owning Product/Scene binding is eligible. Restricted evidence uses separate authorized delivery. TikTok account-link/ownership metadata and Product-detail click-to-load rendering remain outside native image processing.

![Media purpose separates public images from private Chat evidence](graphics/MEDIA_01.svg)
*Figure 01. Media purpose separates public images from private Chat evidence. Downloaded bytes cannot be recalled. Chat evidence cannot use public gallery permissions or native video.*

## 8. Repository Placement

```
Media remains a domain module inside the adulis-platform modular monolith. It is not a separate microservice in the
current release. Seller Console, Mobile and Storefront consume typed REST/OpenAPI contracts and never import Media
repositories directly.
```

Workers may scale separately at deployment time while remaining part of the same codebase and database authority boundary.

```
adulis-platform/
  apps/
    api/
      src/media/
        uploads/ assets/ derivatives/ presentations/ bindings/ lifecycle/ external-embeds/
    worker/
      media-images/ media-reconciliation/ media-lifecycle/
    seller-console/
    mobile/
    storefront/
  packages/
    api-contracts/ analytics-events/ schemas/ design-system/
```

## 9. Canonical Data Model

Technical Media identities and business bindings are separate from publication/distribution eligibility. Every business target is resolved and authorized by its owning domain.

| Entity | Canonical purpose | Fields / rule |
| --- | --- | --- |
| media.asset | Accepted technical IMAGE identity. | Owner scope, technical state, MIME, dimensions, hash and created_at. |
| media.upload_session | Temporary scoped ingest. | Actor/Seller/Market, target/purpose, staging key, limits, expiry and state. |
| media.derivative | Immutable optimized image output. | asset_id, role, format, dimensions, processor_version, presentation parameters and object_key. |
| media.presentation | Versioned visual geometry. | asset_id, crop, normalized orientation/aspect ratio and version. |
| media.binding | Purpose and owning-business reference. | domain_type=PRODUCT_POST/SCENE_POST/CLAIM/etc., domain_id, role, asset/presentation refs; eligibility owned externally. |
| media.external_embed | Approved provider-hosted TikTok reference. | Provider/post identity, Seller/account link ref, verified_at/state; never native video bytes. |

## 10. Media Asset

```
media.asset is the stable technical identity for an accepted Adulis-hosted image. Business objects reference the asset
or presentation, not raw R2 keys.
```

Image replacement creates a new asset identity rather than mutating bytes behind an immutable public URL. The previous asset then enters lifecycle evaluation based on remaining bindings and holds.

• Store width, height and aspect ratio in PostgreSQL before public delivery.

• Store observed MIME and byte size, never trust client-declared values alone.

• Use integrity hash for corruption/duplicate hints, not proof of Seller ownership.

• Do not store raw EXIF GPS in public metadata.

## 11. Media Purposes

Current purposes are image-only and purpose-specific. No passport/national-ID/selfie-match/biometric media purpose exists.

| Purpose | Business target | Rule |
| --- | --- | --- |
| PRODUCT_PRIMARY | Product Post | Primary image; public descriptor only after owning-domain eligibility. |
| PRODUCT_GALLERY | Product Post | Bounded image gallery. |
| SCENE_PRIMARY | Scene Post | Image-led discovery primary image. |
| SCENE_CAROUSEL | Scene Post | Bounded image frames where current Content policy permits. |
| SCENE_PRESENTATION | Scene Post | Canonical versioned geometry for optional Product hotspots. |
| CLAIM_ATTACHMENT | Claim | Restricted/private evidence; no unrestricted CDN. |
| MODERATION_EVIDENCE | Moderation case | Authorized restricted evidence. |
| EXTERNAL_POSTER | TikTok Product-detail embed | Adulis-hosted image placeholder where approved. |

If previous purpose/binding values are deployed, add canonical SCENE_* and SCENE_POST values, migrate references with bounded legacy read compatibility and generated-client checks, then retire obsolete writes. Product-domain naming is canonical Scene throughout.

| New purpose | Typed business target / rule |
| --- | --- |
| CHAT_ATTACHMENT | Conversation + pending send intent + immutable Message + sender; PRIVATE_CHAT participant/team authorization, never public image descriptor. |

CHAT_ATTACHMENT is a PRIVATE Media purpose bound to typed conversation_id, pending_message/send intent, eventual immutable message_id and sender ordinary_account_id. Chat verifies current participant/exact Seller-team permission on upload, completion, bind and every new read. Upload grants/object keys stay private; READY is technical only. One upload-completion/send identity attaches once; cross-conversation rebinding and public PRODUCT_GALLERY delivery are forbidden. Reuse bounded approved image processing/limits; abandoned grants expire under approved policy. No new numeric limits or native video.

## 12. Access Classes

Access is checked per authorized binding/use. One asset may have surviving independent eligible bindings; hiding a Scene does not blindly remove a public Product binding to the same bytes.

| Access class | Example | Distribution rule |
| --- | --- | --- |
| PUBLIC | Eligible Product or PUBLIC Scene binding. | Versioned approved CDN descriptors only after current business checks. |
| SELLER_PRIVATE | Draft or retained PRIVATE Scene management. | Authenticated current Seller permission/scope; no public Scene descriptor. |
| EVIDENCE_RESTRICTED | Claim/Moderation/authorized investigation. | Purpose/case-scoped authentication or narrow signed access. |
| STAGING | Uncommitted upload. | Private R2, expiry, no public descriptor. |
| RETIRED | No active public distribution binding. | No new public binding delivery; retain/evaluate references and holds. |

| Access class | Distribution |
| --- | --- |
| PRIVATE_CHAT | Every new read verifies current conversation participant / exact Seller TEAM reply/read capability. No public descriptor. Selected promoted evidence requires separate case purpose. |

## 13. Asset Processing State Machine

Upload progresses REQUESTED -> UPLOADING -> UPLOADED -> PROCESSING -> READY. Expired/abandoned sessions, rejected validation and failed processing are typed outcomes, not public assets. READY indicates technical safety only.

Separate lifecycle/distribution handling may retire eligible unreferenced assets and schedule DELETE_PENDING -> DELETED only after binding/reference/hold checks. A hold pauses destructive cleanup. R2 failure is never reported as deleted.

Stock-driven Scene privacy leaves technical READY and preserved bytes intact; it changes Scene-specific public binding distribution without quarantine, deletion or automatic retirement of a shared asset.

![Technical processing and business distribution are separate](graphics/MEDIA_02.svg)
*Figure 02. Technical processing and business distribution are separate. Expired, rejected or failed uploads do not produce publishable assets; READY still requires current owning-object public eligibility and lifecycle/hold checks.*

## 14. Upload Session and Capability Grant

Normal Seller image bytes go directly from the browser/client to private R2 staging after the backend creates a narrowly scoped grant. The API must not proxy ordinary large image bodies through NestJS.

The upload grant is a capability, not general storage credentials. It is bound to authenticated actor, Seller, Market context, target domain object/purpose, MIME policy, maximum bytes and expiry.

• Server generates object keys.

• Never include phone, email, Seller handle, Product name, bank/account data or other PII in object keys.

• CORS is not authorization.

• A grant cannot be re-targeted to another Product/Post by modifying client parameters.

CHAT_ATTACHMENT is a PRIVATE Media purpose bound to typed conversation_id, pending_message/send intent, eventual immutable message_id and sender ordinary_account_id. Chat verifies current participant/exact Seller-team permission on upload, completion, bind and every new read. Upload grants/object keys stay private; READY is technical only. One upload-completion/send identity attaches once; cross-conversation rebinding and public PRODUCT_GALLERY delivery are forbidden. Reuse bounded approved image processing/limits; abandoned grants expire under approved policy. No new numeric limits or native video.

## 15. Upload Authorization

| Check | Required behavior |
| --- | --- |
| Authentication | Valid current Account/session; server-derived actor |
| Seller scope | Active Seller relationship and permission |
| Target ownership | Target Product/Scene draft belongs to active Seller |
| Market | Target inherits the Seller current Market |
| Purpose | Allowlisted purpose for the target entity |
| Media type | Image only in current Seller publishing path |
| Limits | Configured bytes, pixel area, dimensions, count and rate |
| Moderation/security | No active block preventing upload or publication |

Scene media requires seller.content_media:manage and the relevant Scene write/tag/publication capabilities through owning workflows. CAMPAIGN_MANAGER manages Scene media where granted; INVENTORY manages Product media where granted. Console-only authoring cannot be enabled by Mobile/request headers.

## 16. Product Post Image Flow

Seller Console creates/edits the Product Post and requests PRODUCT_PRIMARY/PRODUCT_GALLERY scoped grants. The client uploads directly to private R2 staging, completes validation/Sharp processing, and Catalogue binds READY asset/derivatives. Catalogue rechecks owning Product publication before Product detail/Shop/Search/Storefront receives approved descriptors.

![Product image to approved commerce presentation](graphics/MEDIA_03.svg)
*Figure 03. Product image to approved commerce presentation. Direct scoped upload and technical processing precede the Catalogue-owned publication decision and bounded Product image delivery.*

## 17. Scene Post Image Flow

Seller Console creates/edits a Scene working revision, requests SCENE_* scoped upload grant, uploads directly to private R2 staging, completes validation/Sharp normalization and obtains READY MediaAsset/presentation/derivatives. Content binds the ready references, adds valid same-Seller Product tags and optional hotspots, then evaluates full publication readiness before freezing a published revision.

FYP, launch Scene Search and Storefront consume descriptors only while the Scene is currently PUBLIC eligible. Seller Companion may read status/alerts but cannot create, replace, edit, publish, retag or archive Scene media/content.

![Scene image to eligible immutable revision](graphics/MEDIA_04.svg)
*Figure 04. Scene image to eligible immutable revision. Media creates technical assets/presentations; Content validates caption, same-Seller tags and availability before any public descriptor is issued.*

## 18. Online-Only Mutation Rule

Adulis is online-only for current media mutation. Upload grant creation, upload completion, binding, publication and deletion requests require network connectivity and server authorization. A client may keep temporary local UI state, but it cannot claim that an upload or media replacement succeeded while offline.

If connectivity fails, the client shows a recoverable pending/error state and retries through the normal server contract. The backend remains authoritative.

## 19. TikTok External Video Boundary

TikTok is the only current external video provider. External video is not an Adulis media upload and is never stored as native video bytes.

A Seller may attach an approved TikTok video link to a Product Post only when the video belongs to the Seller-controlled TikTok creator account connected to Adulis. The canonical external identity is the provider plus TikTok post/video ID, not a mutable share URL.

The embed is supplementary Product detail content. It does not appear as FYP media, Scene Post media, Seller profile feed media or a substitute for the required Product images.

Official-page DM proves approved selected account-control evidence only; it grants no OAuth scope, video query/ownership capability or provider approval. Keep TikTok videos external and Product-only. Ownership-dependent embeds require actual approved supported account/token/scopes and current wrong-owner/private/deleted/revoked checks; fail closed to safe placeholder/link without breaking an independent valid admission path. No TikTok native FYP/Scene video, password/inbox harvesting or session creation.

## 20. TikTok Account Connection

Ordinary Adulis login or another linked social identity does not automatically grant TikTok embed capability. The Product editor keeps the field disabled until the Seller explicitly connects TikTok through the approved account-link/OAuth contract. Adulis never requests or stores the Seller TikTok password.

Persist approved provider identity/ref in the Integration/Auth boundary; use provider-required state/PKCE and server Seller binding. Disconnect/revoke re-evaluates existing embed eligibility. Current ordinary MVP sign-in remains Adulis-owned phone OTP.

Social capabilities are per-provider/account type, API version and approval, not a generic Login Kit promise. TikTok Login/account control is distinct from approved Display API v2 video ownership using an authorized video.list token; provider stable identity, callback state/replay, minimal fields and revoke/recheck lifecycle are recorded. Instagram Login supports professional Business/Creator accounts; unsupported consumer accounts use a separately valid approved admission path, not invented API access. Exact live app products/scopes/version/evidence fields and approval refs remain unconfirmed until verified.

## 21. TikTok Ownership Verification

When the Seller submits a TikTok URL, the backend resolves the canonical provider post identifier and verifies, using the approved provider contract, that the post belongs to the TikTok creator identity connected to that Seller.

If ownership cannot be proven, fail closed: the embed cannot be published. Manual URL possession, page screenshots, matching display names or client assertions are not sufficient proof.

| Stored fact | Purpose |
| --- | --- |
| provider = TIKTOK | Explicit provider allowlist |
| provider_post_id | Stable external identity |
| connected_account_ref | Which linked TikTok identity was checked |
| verified_at | Freshness/audit |
| verification_status | ELIGIBLE / INELIGIBLE / NEEDS_RECHECK |
| last_checked_at | Health/revalidation |
| submitted_url_normalized | Optional operational trace; not canonical identity |

Official-page DM proves approved selected account-control evidence only; it grants no OAuth scope, video query/ownership capability or provider approval. Keep TikTok videos external and Product-only. Ownership-dependent embeds require actual approved supported account/token/scopes and current wrong-owner/private/deleted/revoked checks; fail closed to safe placeholder/link without breaking an independent valid admission path. No TikTok native FYP/Scene video, password/inbox harvesting or session creation.

## 22. TikTok Embed Rendering

External content loads only after explicit Buyer action. Product detail first renders Adulis-hosted Product images and a poster/neutral placeholder. Selecting the TikTok action opens the approved embed in a restricted WebView/browser/embed container according to surface capabilities.

The Product remains complete if TikTok is deleted, geo-blocked, rate-limited, unavailable or denied by the client environment.

• Allowlist approved TikTok origins.

• No privileged Adulis JavaScript injection.

• No Adulis session tokens inside embed URLs.

• Block arbitrary navigation where the surface allows.

• Do not auto-load third-party video during FYP scrolling.

• Do not use TikTok availability as Product price/stock truth.

## 23. No Native Video Infrastructure

Current Media does not accept Seller video files for Product Posts or Scene Posts. Upload policy rejects video MIME/content before durable publication. There is no current video object kind, transcode service, codec parser workflow, adaptive streaming manifest, native video derivative tier or Seller-video CDN pipeline.

This is intentional cost and complexity control. A future native-video decision requires its own capacity, moderation, security, analytics and delivery design rather than quietly extending image workers.

## 24. Image Completion and Validation

After direct upload, the client calls the Media completion endpoint. The server locks the UploadSession, checks expiry/actor/target, confirms the staging object exists, obtains observed metadata, compares size/type constraints and enqueues bounded processing.

```
An uploaded staging object is not a publishable MediaAsset. Publication requires asset.state = READY and
purpose/ownership authorization.
```

• Inspect magic bytes / actual content type.

• Safe-decode supported formats.

• Bound compressed bytes and decoded pixel count.

• Reject decompression bombs and malformed images.

• Normalize orientation.

• Strip or minimize metadata according to privacy policy.

• Reject unsupported animated/active-content formats according to policy.

## 25. Sharp Image Processing

Sharp runs in bounded worker processes, not synchronously in public API request handling. Workers are treated as security-sensitive because they parse attacker-controlled bytes.

Use explicit concurrency, memory and processing-time limits. Patch image-codec dependencies promptly and isolate worker failures from the API process.

• Decode and normalize image orientation.

• Remove unsafe/unneeded metadata.

• Generate sanitized master where policy requires it.

• Generate bounded derivative roles.

• Write derivative metadata before publication response references it.

• Make the job idempotent under duplicate BullMQ delivery.

## 26. Derivative Architecture

| Role | Typical use | Characteristics |
| --- | --- | --- |
| THUMB | Seller/product lists | small, low byte budget |
| CARD | Shop/Search/Storefront card | bounded dimensions, layout-stable |
| FYP | Scene-only image feed | fast image-led display, known aspect ratio |
| DETAIL | Product/Scene detail | higher fidelity, still bounded |
| SCENE | Scene Explorer | preserves canonical presentation geometry |
| POSTER | TikTok external-video placeholder | Adulis-hosted image only; no external video bytes |

## 27. Deterministic Derivative Identity

A derivative is identified by MediaAsset + role + processor version + relevant presentation parameters. Retried processing must converge on the same logical derivative instead of creating duplicate objects.

Image-processing behavior changes create a new processor version and new immutable delivery URLs. Never overwrite a published CDN object with different bytes under the same immutable key.

## 28. Image Format Strategy

Format is a delivery optimization, not a Product/Post invariant. Keep a baseline-compatible representation and enable WebP/AVIF only where device/browser support and measured savings justify them.

Clients receive a delivery descriptor containing supported variants and choose through normal HTTP/content negotiation or capability-aware application logic. Business objects reference MediaAsset, not a specific encoding.

## 29. FYP Media Rules

The FYP receives Scene Post image descriptors only. It must not receive Product Post as a top-level feed unit and must not receive TikTok embeds as feed media.

Infinite discovery must not create infinite concurrent network traffic. Mobile uses FlashList plus a bounded current/near-next/recent-back prefetch window and cancels obsolete requests during rapid scroll.

• Known width/height/aspect ratio before fetch to avoid layout shift.

• Thumbnail/placeholder first where appropriate.

• No full-resolution images in feed cards.

• No external third-party video prefetch.

• Media failure degrades the unit safely; commerce truth is re-read when Product is opened.

## 30. Scene Post Presentation Geometry

Scene Product hotspots are interpreted against canonical media.presentation after EXIF/orientation normalization and an explicit crop definition. Normalized x/y coordinates lie in [0,1] relative to that presentation, not raw file/device pixels or an arbitrary CDN transform.

Published revision refers to the exact presentation version. Changed crop/orientation creates a new version and requires correct hotspot transformation/revalidation. Derivative policy changes never silently move commerce hotspots; accessible Product lists remain available without overlay interaction.

```
MediaPresentation
  id / asset_id / purpose=SCENE_PRESENTATION
  crop_x / crop_y / crop_width / crop_height  # normalized
  rotation / aspect_ratio / version
Hotspot: x_norm, y_norm in [0,1] relative to this presentation
```

## 31. Recrop and Hotspot Safety

Changing the Scene crop changes the presentation version. Existing hotspots must be transformed correctly or revalidated before the Seller can publish the revision. A UI redesign or new derivative policy must never silently recrop tagged Scenes in a way that moves commerce hotspots.

Scene Explorer may load a higher-resolution derivative, but it must preserve equivalent presentation geometry.

## 32. Product Images and Scene Images

Product and Scene image roles differ; neither type owns Product price, stock, payment or Trust.

| Use | Product Post | Scene Post |
| --- | --- | --- |
| Purpose | Exact Product understanding, detail, Shop/Search and gallery. | Discovery, merchandising, Product composition and optional hotspots. |
| Native media | Image-only bounded gallery. | Image-led primary/permitted carousel; canonical presentation geometry. |
| FYP unit | Never independent top-level FYP. | Eligible PUBLIC image-only Scene. |
| Search media | Bounded Product-card derivative. | Bounded PUBLIC Scene-card derivative from launch. |
| TikTok | Optional click-to-load Product detail after connected-account ownership check. | Never Scene/FYP/Search media. |

## 33. Moderation Integration

```
Media technical readiness and Moderation distribution eligibility are independent. READY means the image passed
technical processing; it does not mean the Product/Scene Post is policy-approved.
```

When Moderation removes content, authoritative public eligibility changes immediately. CDN/public projection invalidation follows asynchronously and is retried. Media referenced by a report, appeal, Claim or security hold remains restricted rather than being destructively deleted.

Stock-driven Scene PRIVATE is not a Moderation quarantine. Content visibility controls current Scene distribution independently of technical readiness and Moderation; restoration reuses valid derivatives only if media and all owning-domain restrictions permit.

## 34. Quarantine

Media can move to a non-public restricted/quarantined access state when technical or safety review requires it. Quarantine prevents new public delivery without rewriting the owning Product/Scene Post history.

Quarantined assets are never exposed through a permanent public CDN URL.

## 35. Claims and Evidence Preservation

Claims may reference the exact Product/Scene revision and MediaAsset shown to a Buyer. Claim opening can establish a retention hold on the required asset/presentation/derivative or an approved evidence snapshot.

Closing the Claim releases or changes the hold according to Privacy/Data Lifecycle policy; it does not imply immediate byte deletion.

## 36. Media Lifecycle

| State | Meaning | Public behavior |
| --- | --- | --- |
| HOT | Actively referenced public/current media | Normal delivery |
| INFREQUENT | Still referenced but low-use/historical | May use lower-cost storage while still retrievable |
| RETIRED | No new active public binding | No new public exposure; retention evaluated |
| DELETE_PENDING | Eligible and deletion scheduled | Public/cache binding already removed |
| DELETED | Physical bytes removed and metadata finalized | Not retrievable |

When the last tagged Product becomes unavailable, Content changes PUBLISHED/PUBLIC -> PUBLISHED/PRIVATE. Media stops new Scene-specific public descriptors, invalidates controlled public projections, and preserves READY bytes/references/holds. PUBLIC restoration can reuse same asset/presentation/processor-version derivatives without unnecessary regeneration. A Scene-only distribution change does not retire an asset with another valid binding.

![Current eligibility runs before every new controlled Scene delivery](graphics/MEDIA_05.svg)
*Figure 05. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

## 37. Retention and Deletion

Public removal and physical deletion are separate. When Product/Post is deleted, archived or moderated, public binding and CDN exposure are removed first. Physical object deletion occurs only after Media verifies there are no surviving bindings and no active Claims, Moderation, legal or security holds.

Retention durations are policy-owned and versioned. Media must not hard-code arbitrary retention-day constants. Deletion jobs are idempotent and must not report success when R2 deletion failed.

Stock privacy itself is not physical deletion. Scene revision/evidence and retained Seller management references remain. Deletion is permitted only through the existing central policy/reference/hold lifecycle.

## 38. Seller Closure and Account Deletion

Account/Seller lifecycle commands reach Media through the platform lifecycle contract. Media identifies assets/bindings owned by the subject, removes public exposure where required, retains held/evidence material, and schedules eligible unreferenced bytes for deletion.

Deleting an Account must also remove private draft media and unneeded user-specific objects once blockers/holds clear, while preserving minimum evidence references where policy requires them.

## 39. Orphan and Reconciliation Jobs

R2 and PostgreSQL are not one atomic transaction. Reconciliation must detect staging objects without sessions, DB assets with missing objects, derivatives missing required metadata, and deletion metadata that disagrees with physical storage.

Do not rely on full-bucket LIST sweeps as the only mechanism. Prefer indexed DB lifecycle state plus bounded prefix/inventory reconciliation and provider inventory tools where available.

## 40. CDN Architecture

Public image derivatives use Cloudflare CDN/custom media domain with immutable versioned keys. CDN cache is a delivery optimization and cannot authorize current Product availability, content publication or Moderation eligibility.

Private draft/evidence media never use unrestricted public CDN URLs.

• Aggressive immutable caching for public versioned derivatives.

• Surrogate/cache tags where useful for page/projection invalidation.

• Explicit purge on moderation/public-binding removal, plus bounded TTL as recovery.

• Cache key must include object/version semantics; no Seller/user secrets.

Scene PRIVATE transition stops new Adulis-controlled FYP/Search/Storefront/public detail distribution through current binding authorization, descriptor/projection invalidation and purge/retry. Do not claim cryptographic recall of formerly public bytes cached/copied externally. Shared Product bindings and held evidence are evaluated separately. Public access returns only currently eligible owning-object descriptors; a stale CDN/cache decision cannot make a PRIVATE Scene readable.

Every NEW controlled Scene-bearing HTML/JSON, list/card, direct link and social-metadata response runs a batched authoritative eligibility decision BEFORE delivery. Read current Product availability and independent Content publication/visibility, Seller, Market, Moderation and Media gates from owner readers; asynchronous projection or cached eligibility bit cannot authorize. Last available tag loss denies new public delivery even while Content projection/purge jobs lag. On owner-read/origin failure, deny/omit Scene payload and return a safe unavailable response; do not serve stale sensitive content.

Cache genuinely non-sensitive static shells and permitted immutable image/static assets only. Scene-bearing data/HTML/caption/title/card/meta bypasses full-page/data CDN caching, ISR and stale-while-revalidate unless the authoritative decision still runs before every delivery. Dynamic nonce HTML uses the existing fresh per-response CSP nonce profile and no shared HTML cache; static asset policies stay compatible. Already delivered bytes, in-flight responses and external screenshots/copies cannot be recalled. Authorized Seller-private and case-scoped Operator access are separately authenticated.

## 41. Media API Catalogue

| Method | Route | Purpose |
| --- | --- | --- |
| POST | /v1/media/uploads | Create image upload session + grant |
| POST | /v1/media/uploads/{id}/complete | Verify object + enqueue processing |
| GET | /v1/media/uploads/{id} | Read technical processing status |
| POST | /v1/media/bindings | Bind ready asset to authorized Product/Scene draft |
| DELETE | /v1/media/bindings/{id} | Remove authorized binding; trigger lifecycle evaluation |
| GET | /v1/media/assets/{id}/delivery | Authorized delivery descriptor |
| POST | /v1/integrations/tiktok/connect | Start approved TikTok account-link flow |
| POST | /v1/products/{id}/tiktok-embed | Resolve + verify Seller-owned TikTok post |
| DELETE | /v1/products/{id}/tiktok-embed | Remove external embed reference |

POST /v1/conversations/{conversationRef}/attachment-uploads creates CHAT_ATTACHMENT upload intent; completion associates only its original pending Message/send identity. Message commit binds once through approved Chat/Media owner interfaces. GET authorized Message attachment delivery rechecks current participant/scope; DELETE requests owner lifecycle, not held evidence destruction.

Selected Claim/Moderation/legal/security attachment evidence uses existing exact hold/purge fences; ordinary message removal cannot erase held bytes. After release apply approved lifecycle and orphan reconciliation. Purpose-scoped bounded signed access never promises recall of previously downloaded bytes or already issued access grants. Public descriptors, notifications, Analytics/logs and unrelated exports exclude private attachment bytes and URLs.

## 42. API Contract Rules

```
•
REST + OpenAPI + @nestjs/swagger define request/response contracts.
```

• Generated TypeScript clients are consumed by Seller Console/Mobile/Storefront where appropriate.

• No client receives raw R2 credentials beyond a single scoped upload capability.

• No arbitrary domain type/id attachment endpoint. Purpose-specific authorization is required.

• TikTok ownership result is server-derived and cannot be client supplied.

• Private/evidence delivery uses authenticated authorization every time.

## 43. Error Taxonomy

| Error | Meaning |
| --- | --- |
| MEDIA_UPLOAD_NOT_AUTHORIZED | Actor/Seller/target/purpose mismatch |
| MEDIA_TYPE_NOT_ALLOWED | Current Seller path received non-image content |
| MEDIA_TOO_LARGE | Compressed bytes exceed policy |
| MEDIA_PIXEL_LIMIT_EXCEEDED | Decoded pixel surface too large |
| MEDIA_DECODE_FAILED | Malformed/unsupported image |
| MEDIA_PROCESSING_FAILED | Worker could not create accepted asset |
| MEDIA_NOT_READY | Owning Product/Post attempted use before READY |
| MEDIA_BINDING_FORBIDDEN | Target/binding not allowed |
| TIKTOK_NOT_CONNECTED | Seller must connect TikTok |
| TIKTOK_OWNERSHIP_NOT_VERIFIED | Submitted post not proven to connected Seller TikTok |
| TIKTOK_EMBED_UNAVAILABLE | External provider health/eligibility unavailable |

## 44. Idempotency and Concurrency

Upload completion, binding creation, destructive lifecycle commands and external-embed attachment use idempotency where duplicate retries could create extra state. Worker jobs are safe for at-least-once delivery.

Published Product/Scene revision changes use owning-domain concurrency controls; Media must not independently rewrite a revision to resolve a race.

Selected Claim/Moderation/legal/security attachment evidence uses existing exact hold/purge fences; ordinary message removal cannot erase held bytes. After release apply approved lifecycle and orphan reconciliation. Purpose-scoped bounded signed access never promises recall of previously downloaded bytes or already issued access grants. Public descriptors, notifications, Analytics/logs and unrelated exports exclude private attachment bytes and URLs.

## 45. Valkey and BullMQ Responsibilities

Valkey is the only current cache/queue backing datastore. It may hold short-lived rate-limit state, processing locks where safe, BullMQ job metadata, bounded delivery/read caches and non-authoritative projection metadata.

It must never be the only copy of MediaAsset state, binding truth, TikTok verification decision, retention hold, deletion result or processing audit.

• BullMQ jobs: image process, derivative generation, reconciliation, cache/CDN purge, lifecycle deletion, optional TikTok recheck.

• Jobs carry opaque references, not unnecessary image/user payloads.

• Dead jobs are observable and retryable; dead letters do not become permanent sensitive-data archives.

## 46. Security Controls

| Threat | Control |
| --- | --- |
| Tenant/IDOR attack | Server-derived Seller scope + target ownership lookup + scoped permissions |
| Malicious file/MIME spoof | Magic-byte inspection + safe decode + allowlist |
| Decompression bomb | Decoded pixel/dimension limits before expensive processing |
| SSRF through TikTok URL | Provider-specific parser/allowlist; do not generic-fetch arbitrary Seller URLs |
| OAuth CSRF/account mix-up | Provider state/PKCE and Seller/account binding checks |
| Public leakage of evidence | Separate access class; no unrestricted CDN URL |
| XSS/active upload | Reject SVG/HTML as Seller image media unless a future dedicated safe path exists |
| PII leakage in storage keys/logs | Opaque IDs + strict redaction |
| Stale removed image in CDN | Purge + immutable URLs + bounded page TTL + authoritative eligibility |

## 47. No Hidden Biometric or Location Processing

Image processing performs no face recognition, biometric/identity inference or hidden EXIF-location enrichment. Strip/minimize EXIF GPS and private camera metadata. Never reuse uploaded image GPS to validate Seller location, track Couriers or supply fulfilment checkpoints; Fulfilment captures explicit foreground checkpoint evidence under its own policy.

Current Seller/Courier platform verification has no government-document or selfie-to-ID media workflow. Restricted Claim/Moderation evidence remains a separate legitimate purpose with case-scoped access and retention/holds.

## 48. Quotas and Abuse Controls

Current Adulis does not impose Product Post or Scene Post count limits as a business-tier feature. Media still requires operational protection against abuse: per-upload byte/pixel limits, bounded concurrent processing, rate controls, draft-orphan cleanup and storage anomaly alerts.

Operational quotas are safety/cost controls and must not be presented as a commercial post-count allowance.

## 49. Observability

Media uses Sentry, Pino and platform infrastructure signals. Observability must distinguish API upload failures, R2 failures, image-processing failures, BullMQ backlog, CDN delivery failure, lifecycle deletion failure and TikTok integration failure.

Logs are structured and redacted. Never log upload grants, TikTok OAuth tokens, raw external provider payloads, private signed URLs, image bytes or sensitive user-entered metadata.

Scene visibility correctness metrics include PRIVATE with stale public descriptor/projection, restored PUBLIC descriptor failure, PRIVATE media returned by FYP/Search, binding/public-state drift and CDN purge/retry failures. Raw private evidence never goes to Sentry/Analytics.

## 50. Media Metrics

| Metric family | Examples |
| --- | --- |
| Ingest | upload grants issued, upload completion success, abandonment/expiry, rejected MIME/size/pixel count |
| Processing | queue wait, Sharp duration, READY/FAILED ratio, retry/dead-job count |
| Delivery | CDN hit ratio, derivative byte volume, 4xx/5xx, FYP image LCP/load failure |
| Lifecycle | retired assets, deletion backlog, object-delete retry, orphan reconciliation count |
| Security | authorization denials, malformed file rejects, rate-limit hits, suspicious TikTok-link attempts |
| External embed | connect success, ownership-verification outcome, embed-health status; no native video telemetry |

| Additional correctness metric | Required interpretation |
| --- | --- |
| PRIVATE distribution leak | Any PRIVATE Scene returned through new FYP/Search/Storefront descriptors is a correctness incident. |
| Restoration descriptor failure | Content PUBLIC restoration succeeds but eligible derivative binding cannot resolve. |
| Binding-state drift | Projection disagrees with current owning-domain eligibility. |
| Purges and resource failures | Purge/retry, orphan rate, derivative retries, Sharp memory/time limits, malicious-image and capability-abuse rejection. |

## 51. Cost Architecture

• Direct-to-R2 upload avoids API bandwidth amplification.

• Generate a bounded derivative set based on real roles rather than arbitrary device widths.

• Immutable CDN caching reduces origin/R2 reads.

• Do not reprocess images per request.

• Delete abandoned staging objects quickly.

• Lifecycle historical/low-use objects according to R2 policy while preserving required availability.

• No native video storage/transcoding tier in current release.

• Monitor bytes stored, derivatives per asset, processing CPU, CDN egress and orphan growth.

## 52. Accessibility

Media delivery descriptors should support meaningful alt-text fields from owning Product/Scene domains without inventing visual facts. Hotspot experiences must also expose an accessible non-visual tagged-product list.

Images are not the only way to identify Product name, price or availability. Placeholder/failure states retain textual commerce context.

## 53. Current Technology Stack and Media Impact

| Layer | Canonical technology | Media impact |
| --- | --- | --- |
| Backend | Node.js; NestJS; Fastify; strict TypeScript | Media APIs, authorization orchestration, integration endpoints |
| Persistence | Drizzle ORM; PostgreSQL | Canonical asset/session/derivative/presentation/binding metadata |
| PostgreSQL extensions | pg_trgm; btree_gist; pg_stat_statements | Query diagnostics; selective search/constraint use where justified |
| Async / cache | Valkey; BullMQ | Image jobs, invalidation, reconciliation, rate state; non-authoritative |
| API | REST; OpenAPI; @nestjs/swagger; generated TypeScript client | Typed Seller Console/Mobile/Storefront contracts |
| Security | @nestjs/throttler; @fastify/helmet; libphonenumber-js | Rate limiting/headers; phone library shared platform dependency, not Media authority |
| Image media | Cloudflare R2; Cloudflare CDN; Sharp | Direct upload, object storage, derivatives, public delivery |
| Mobile | React Native; Expo; Expo Router; TanStack Query; FlashList; Expo Image; SecureStore; SQLite; Camera; Notifications; Updates; small Zustand | Image display/capture, FYP virtualization, typed server state; no offline media mutation authority |
| Quality | Jest; Testcontainers; Maestro; Playwright; k6 | Unit/integration/mobile/browser/load testing |
| Observability | Sentry; Pino; pg_stat_statements | Errors, structured redacted logs, DB performance |
| Architecture control | dependency-cruiser | Enforce domain seams and repository boundaries |

| Layer | Canonical technology | Media impact |
| --- | --- | --- |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS | API/worker deployment, CDN/R2, Mobile release |
| External video | TikTok account-link/ownership-verification adapter + approved embed | Product-Post-only external video; no native video storage |

## 54. Testing Strategy

• Jest for validators, state transitions, image-role policy, URL/provider parsing and lifecycle logic.

• Testcontainers for real PostgreSQL/Valkey constraints, outbox, idempotency and worker integration.

• Playwright for Seller Console image authoring, TikTok connect/embed flow and Product/Post public rendering.

• Maestro for Mobile FYP image behavior, Product Post detail, click-to-load TikTok embed boundary and failure states.

• k6 for upload-grant API, media-status API and high-volume public delivery descriptor/load paths.

• Security-negative tests for Seller-scope isolation, malicious files, signed grant misuse, SSRF attempts and provider token leakage.

## 55. Critical E2E - Product and Scene Images

• Product image upload -> hostile-image validation -> READY -> owning Product publication.

• Scene image upload -> versioned presentation -> same-Seller available Product tags/hotspots -> PUBLIC immutable Scene revision.

• FYP loads bounded Scene image; Product detail loads independent Product images; no Product top-level FYP or Scene-owned price/stock.

• Last available tag lost -> Content PRIVATE -> no new public Scene descriptor/FYP/Search/Storefront resolution; bytes stay READY/retained.

• Restock -> all-gate Content PUBLIC -> reuse valid immutable derivatives; restriction or archive prevents restoration.

• Launch Scene Search uses bounded Scene-card derivative; PRIVATE result/deep link cannot resolve private media.

## 56. Critical E2E - TikTok Ownership

```
Seller authenticated to Adulis using any supported primary method
  -> Product editor shows TikTok feature disabled until connection
  -> connect TikTok account A
  -> attach TikTok post owned by A -> provider verification -> eligible embed
  -> attach post owned by B -> rejected
  -> Buyer opens Product Post -> Adulis images render first -> explicit click loads TikTok
  -> TikTok unavailable -> Product Post still fully usable
  -> disconnect/revoke TikTok -> new embeds disabled; existing embed follows revalidation policy
```

## 57. Critical E2E - Reject Seller Video Upload

Attempt to upload MP4/WebM/MOV or a video disguised with an image extension to Product or Scene media endpoint. Expected: request/object fails media-type validation before becoming a publishable asset; no native video worker or derivative path is created.

## 58. Critical E2E - Scene Geometry

Upload and normalize image with EXIF rotation, create canonical presentation, place hotspot at normalized coordinates, publish Scene Scene, render on multiple phone widths and Scene Explorer, then recrop the draft.

Expected: hotspot remains correct for the published presentation; recrop requires transform/revalidation before the new revision publishes.

## 59. Critical E2E - Lifecycle and Holds

Publish media, open a Claim referencing the exact Product/Scene revision, remove public content, then request deletion. Expected: public delivery is removed, evidence bytes remain restricted under hold, deletion resumes only after policy permits, and R2 failure cannot be falsely reported as deleted.

PRIVATE due solely to stock does not quarantine or delete. Shared eligible Product binding survives Scene privacy; exact Scene/MediaAsset/MediaPresentation/evidence snapshot under hold remains restricted until lifecycle policy permits deletion.

## 60. Load and Failure Testing

• High concurrent direct-upload grant creation does not saturate API workers.

• BullMQ backpressure keeps Sharp worker memory/CPU bounded.

• R2 transient failures retry without creating false READY state.

• Valkey outage degrades queue/cache-dependent operations visibly but does not corrupt PostgreSQL truth.

• CDN outage preserves origin/retry behavior without leaking private paths.

• Provider/TikTok outage never breaks Product core commerce rendering.

• Viral FYP traffic is absorbed primarily by CDN, not one database query per image view.

## 61. MVP Scope

• Product Post image upload/gallery pipeline.

• Scene Post image upload and Scene presentation support.

• Direct R2 staging upload with scoped grant.

• Sharp validation/normalization/derivatives.

• Immutable CDN delivery descriptors.

• Presentation geometry and normalized hotspot support.

• Moderation/Claims/Privacy lifecycle integration.

• TikTok account connection + ownership verification + Product-detail-only external embed.

• Valkey/BullMQ jobs and reconciliation.

• Current observability, security, testing and deployment stack.

• Scene PRIVATE/PUBLIC consequence integration, current binding checks and safe derivative reuse.

• Bounded launch Scene Search media cards; Seller Scene permission enforcement.

• No Government-ID/biometric media or standalone Creator ownership infrastructure.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 62. Explicitly Deferred

• Native Seller video uploads.

• Video transcoding, adaptive streaming and dedicated video storage/worker tiers.

• Additional external video providers.

• Automatic image/video product recognition.

• Face recognition or biometric inference.

• Arbitrary Seller-controlled CDN transforms.

• Media microservice split without measured scale/isolation need.

• Advanced asset deduplication that risks ownership/privacy ambiguity.

• Third-party media-library/PIM integrations unless approved by a future product decision.

• Standalone Creator media ownership/tables/permissions remain outside MVP until separately approved; a creator operating as Seller uses Seller-owned media rules.

## 63. Core Invariants

```
MEDIA-INV-01  Product Post and Scene Post native media are images in current release.
MEDIA-INV-02  TikTok is the only current external video path.
MEDIA-INV-03  TikTok embed is Product-Post-detail-only and requires Seller-linked ownership verification.
MEDIA-INV-04  FYP never receives external TikTok video as feed media.
MEDIA-INV-05  Seller video files cannot become publishable MediaAssets.
MEDIA-INV-06  Media technical READY is not publication or Moderation approval.
MEDIA-INV-07  PostgreSQL is canonical for Media metadata/state.
MEDIA-INV-08  Valkey/BullMQ/CDN/client cache are non-authoritative.
MEDIA-INV-09  Business domains reference MediaAsset/presentation, never depend on raw R2 keys.
MEDIA-INV-10  Public immutable URLs never change bytes in place.
MEDIA-INV-11  Scene hotspots bind to versioned normalized presentation geometry.
MEDIA-INV-12  Private/evidence media never has unrestricted public delivery.
MEDIA-INV-13  Physical deletion never bypasses active holds/references.
MEDIA-INV-14  Clients never authorize media writes or TikTok ownership by themselves.
MEDIA-INV-15  Current media mutations require network/server confirmation.
```

MEDIA-INV-16 Scene PRIVATE removes new Adulis-controlled public Scene distribution without automatically deleting canonical bytes.

MEDIA-INV-17 Media never decides Scene visibility, public Search rank or Product sellability.

MEDIA-INV-18 No current Government-ID/selfie-match/biometric media path exists.

## 64. Production Launch Gates

• Product/Scene image upload paths reject non-image Seller files.

• Scoped grant cannot be replayed against another Seller/target/purpose.

• Malicious MIME, decompression-bomb and malformed-image tests pass.

• EXIF GPS/private metadata minimization verified.

• Derivative generation is idempotent and immutable URLs are stable.

• FYP serves bounded Scene image descriptors only.

• Scene geometry remains correct across supported displays.

• TikTok field remains disabled until Seller connects account.

• TikTok post ownership verification fails closed.

• TikTok embed is click-to-load and Product-detail-only.

• Product page remains complete when TikTok fails.

• No provider secret/token reaches browser logs or analytics.

• Moderation removal invalidates public delivery/cache.

• Claim hold wins deletion race.

• R2/DB reconciliation and deletion retry verified.

• Valkey/BullMQ outage behavior tested.

• Sentry/Pino/pg_stat_statements dashboards and alerts wired.

• Jest/Testcontainers/Playwright/Maestro/k6 release gates pass.

• Last available tag privacy removes controlled public Scene delivery across FYP/Search/Storefront/detail; delayed projections fail current authorization.

• PUBLIC restoration safely reuses eligible derivatives while respecting independent restrictions, shared bindings and holds.

• Launch Scene Search bounded derivatives, Campaign/Inventory purpose authorization and no Government-ID path are verified.

## 65. Recommended Implementation Sequence

```
PHASE 0 - DOMAIN & SECURITY
  asset/session/derivative/presentation/binding schema
  Seller/target/purpose authorization
  object-key and redaction rules
```

```
PHASE 1 - IMAGE INGESTION
  R2 staging grants -> complete -> validate -> READY
  Sharp normalization and bounded derivatives
```

```
PHASE 2 - PRODUCT + SCENE BINDINGS
  Product gallery bindings
  Scene/Scene image presentation + geometry
  Seller Console authoring integration
```

```
PHASE 3 - DELIVERY
  immutable CDN URLs / delivery descriptors
  FYP / launch Scene Search / Storefront / Product-detail integration
```

```
PHASE 4 - TIKTOK EXTERNAL EMBED
  account connection -> ownership verification -> safe Product-detail render
```

```
PHASE 5 - LIFECYCLE / SAFETY
  Moderation / Claims / deletion / reconciliation / CDN purge
```

```
PHASE 6 - HARDENING
  security-negative tests / load / restore / cost dashboards / production gates
```

Add Content visibility consequence processing, binding/public-state reconciliation and privacy/restoration E2E before launch. Keep current direct R2 grants, bounded Sharp workers and BullMQ; no extra engine or Media search service.

## 66. Final Architecture Diagram

The Media pipeline retains technical ownership and delegates public business eligibility to the current owning domain. Separate evidence delivery and optional TikTok Product detail remain explicit.

![Media purpose separates public images from private Chat evidence](graphics/MEDIA_06.svg)
*Figure 06. Media purpose separates public images from private Chat evidence. Downloaded bytes cannot be recalled. Chat evidence cannot use public gallery permissions or native video.*

![Current eligibility runs before every new controlled Scene delivery](graphics/MEDIA_07.svg)
*Figure 07. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

## 67. Final Engineering Doctrine

The Media system must not be reduced to "upload a file and save a URL." The correct abstraction is: an upload is temporary and untrusted; a MediaAsset is an accepted technical image; a Presentation defines stable visual geometry; a Derivative is an optimized delivery representation; a Binding explains why an asset exists; Moderation determines whether it may be distributed; lifecycle and holds determine how long it survives; CDN delivers bytes efficiently.

Product Posts and Scene Posts consume Media but do not own storage mechanics. TikTok external video is intentionally outside the native image pipeline: it is provider-hosted, Seller-account-verified, Product-detail-only and optional. This boundary keeps the current MVP operationally affordable while preserving clean seams for a future dedicated richer-media architecture if product evidence justifies one.

Scene stock privacy changes controlled distribution, not technical image truth. Content owns visibility; current binding checks protect public surfaces; ready immutable derivatives and held evidence survive while policy permits. New descriptors stop for PRIVATE Scenes, while formerly public Internet copies cannot be recalled.

## 68. Appendix - Private Chat Attachment Contract & Fixtures

CHAT_ATTACHMENT is a PRIVATE Media purpose bound to typed conversation_id, pending_message/send intent, eventual immutable message_id and sender ordinary_account_id. Chat verifies current participant/exact Seller-team permission on upload, completion, bind and every new read. Upload grants/object keys stay private; READY is technical only. One upload-completion/send identity attaches once; cross-conversation rebinding and public PRODUCT_GALLERY delivery are forbidden. Reuse bounded approved image processing/limits; abandoned grants expire under approved policy. No new numeric limits or native video.

Selected Claim/Moderation/legal/security attachment evidence uses existing exact hold/purge fences; ordinary message removal cannot erase held bytes. After release apply approved lifecycle and orphan reconciliation. Purpose-scoped bounded signed access never promises recall of previously downloaded bytes or already issued access grants. Public descriptors, notifications, Analytics/logs and unrelated exports exclude private attachment bytes and URLs.

| Fixture | Expected specification outcome |
| --- | --- |
| Wrong conversation / sender / Seller TEAM | Upload/bind/read denied by current scoped authority; no public descriptor. |
| Completion/send replay | Same upload/send identity binds once; incompatible rebind rejected. |
| Abandoned upload / expired access | Approved expiration and orphan reconciliation; no perpetual private staging. |
| Message removal versus scoped hold | No destructive purge of held bytes; release resumes bounded lifecycle. |
| Signed delivery already issued | No promise of retroactive recall; new requests still re-authorize. |

## 69. Glossary

| Term | Definition |
| --- | --- |
| MediaAsset | Stable accepted technical image identity and metadata. |
| MediaDerivative | Immutable bounded image output for a role/processor/presentation version. |
| MediaPresentation | Versioned normalized geometry for consistent image/hotspot rendering. |
| MediaBinding | Purpose/reference connecting technical media to an owning business object. |
| UploadSession | Expiring scoped ingest workflow; staging is not publication. |
| Upload Capability | Narrow actor/Seller/Market/target/purpose/limits/expiry upload grant. |
| Product Post | One Product commercial object consuming eligible image descriptors. |
| Scene Post | Canonical image-led Seller content; Content owns publication/visibility. |
| Scene Image | Native image used by an eligible Scene binding. |
| Scene Presentation | Exact MediaPresentation version referenced by a Scene revision. |
| Hotspot | Normalized Product-tag coordinate tied to the presentation. |
| READY | Technical processing passed; does not authorize public distribution. |
| PUBLIC | Approved current public business binding/delivery class. |
| SELLER_PRIVATE | Authenticated Seller-only draft/private Scene management delivery. |
| EVIDENCE_RESTRICTED | Case/purpose-scoped evidence delivery, never unrestricted CDN. |
| STAGING | Private temporary uploaded bytes pending validation. |
| RETIRED | No current public binding distribution; reference/hold lifecycle still applies. |
| Quarantine | Technical/safety distribution restriction, distinct from stock privacy. |
| Lifecycle Hold | Policy/case blocker preventing destructive evidence cleanup. |
| R2 | Cloudflare object storage for staged, accepted and restricted image bytes. |
| CDN | Cloudflare public derivative delivery/cache; no business authority. |
| Sharp | Bounded image validation/normalization/derivative processing. |
| TikTok External Embed | Optional connected-account-verified, click-to-load Product detail video. |
| Transactional Outbox | Durable post-commit media consequences and reconciliation. |
| BullMQ | Idempotent image/lifecycle/purge/reconciliation jobs. |
| Valkey | Non-canonical queue/cache support. |
| Shoppable Post | Superseded former term for Scene Post. |
