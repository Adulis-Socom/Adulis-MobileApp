# WO-009A -- Buyer Card-Level Saves, Session Hardening and Development Storage

Status: COMPLETE (Workstreams A, B and D); Workstream C in `docs/engineering/`.
Date: 11 November 2026.
Branch: `mobile/wo-009a-card-saves-storage-hardening`.
Starting SHA: `379adb60b3c89bcd4e323a2a2e9def6409579c49`, the accepted WO-009 HEAD, verified equal
to origin with a clean tree.
Code and tests at `e915242`; this record, the storage audit and the register are in the next commit.
The pushed HEAD is named in the final report.

## 1. Scope and authority

- Authority: ADU-SRC-01 v3.2 S18-S22 (Collections, saved-state batching), ADU-MOB-02 v4.3 S39-S42
  (Saved, Buyer navigation) and ADU-AUTH-02 v3.3 (session authorization). ADU-PRV-01 and ADU-DPIA-01:
  no new private data, store, log or analytics. ADU-API-01 / ADU-DB-01 v1.26 unchanged.
- No API, contract, migration or governed document changed. The existing endpoints and generated
  types are used: `POST /v1/collections/saved-state:batch`, `POST .../items`, `DELETE .../items/{itemRef}`.
- Founder decisions not taken here: ON-087, ON-088, ON-090 and ON-091 are still pending and
  their behaviour is unchanged (hard deletes, provisional bounds, no quota, neutral unavailable
  text). ON-079 is still provisional and ON-080 still deferred; payment is undecided. Production For
  You stays disabled and its cards are not touched.

## 2. Implemented features

| Surface | Save on | Target |
|---|---|---|
| Shop | every Product card | PRODUCT_POST = Product.id |
| Search, Top tab | Product rows and Scene rows (never a Seller row) | id / public_ref |
| Search, Products grid | every card | Product.id |
| Search, Scenes grid | every card | Scene.public_ref |
| Seller Profile, Products tab | every card | Product.id |
| Seller Profile, Scenes tab | every card | Scene.public_ref |

- The control is a bookmark: filled when the server holds the target in Saved (the DEFAULT
  Collection), outlined otherwise, so the state never rests on colour. It is a sibling of the
  card's own Pressable (absolute over the photo corner, or at the end of a Top row), so a Save tap
  never opens the card and a screen reader reaches both.
- Save and Remove toggle DEFAULT membership only. A target that is only in a named Collection is
  drawn as not saved; Save adds DEFAULT and the named membership stays. Add to collection (the
  picker) is unchanged.
- States: Save, Saved, Loading (dimmed, disabled, busy), Saving and Removing (spinner, busy, the
  label says which), Error and Retry. A refused or lost Save keeps the server's state and says why
  once, in an alert. A page whose saved state could not be read shows a retry icon, disabled while
  the batch is being read again.
- Accessibility: role togglebutton with checked and busy states; label "Save {name}" (the Product
  name or the Scene caption). At least 44 dp, growing with the font scale. Announcements on success
  reuse "Saved." and "Removed from Saved.". Light and Dark come from theme tokens.
- No Product handle-and-slug identity is used as a target; the return path for a guest is built
  from the card's own handle and slug and checked by `parseReturnTo`.

## 3. Saved-state batching architecture

```
usePublicList  -> pages: [{ receivedAt, items }]  (de-duplicated across pages, as before)
PublicListView -> saves={{ surface, target }}      (target: a stable module-level function)
useCardSaves   -> one TanStack query per page batch:
                  key [saved-state, 'page', receivedAt, ...targets]   <= 60 targets each
                  enabled only signed in; staleTime Infinity; gcTime 0
CardSavesContext -> each card's entry (status, item, retry); useCardSave -> shared mutation
```

- One batch per page of results, never one per card. A target already asked for on an earlier
  page is not asked for again, and a page with more than 60 targets is split.
- A re-render reads nothing, because the key is the page's content plus its arrival time. A pull,
  a return from the background or a refresh on return re-reads the page and so starts a new batch.
- Save and Remove answers are written into every cached saved-state entry holding the target:
  the detail screen's own read and every page batch. Reads still in flight are sent again, so an
  older answer cannot overwrite a newer Save (review R3). Removing an item on a Collection screen
  re-reads the cards' batches.
- Guests send no Collections request at all.
- Measured on the device through a counting proxy (method, path with ids redacted, target count
  only), from the third native pass:

  | Read | Saved-state requests | Targets |
  |---|---|---|
  | Shop page 1 (signed in) | 1 per page load | 30 |
  | Search Top page | 1 | 2 (the Seller row is not a target) |
  | Search Products or Scenes page | 1 | 1 |
  | Seller Profile Scenes / Products page | 1 each | 2 / 4 |
  | Guest Shop | 0 | |
  | Product Detail, the guest continuation | 1 each | 1 |

## 4. Session security changes

**Finding (ON-20261111-103).** Reproduced before fixing. The guest continuation sent its
saved-state read with Account A's credential. When the answer was delayed past a sign-out and
Account B's sign-in, the continuation then POSTed to A's DEFAULT Collection ref with **B's bearer**,
because the client reads the bearer when each request is sent. The real API would refuse it (B does
not own A's Collection: 404), so no data changed, but a mutation was issued under the wrong Account.
The new regression test failed on the old code with exactly that request.

**Fix.**
- `SessionProvider.boundApi(credential)` returns a client that sends exactly that bearer. It
  refuses (`SessionChanged`) before sending once the session is no longer the app's: signed out,
  expired, or another sign-in, including a new sign-in to the same Account.
- The token is read with no await between the check and `fetch`.
- Used by:
  - the continuation, bound to the credential its own sign-in returned;
  - every one-tap Save;
  - every saved-state read, which also re-checks the session after its answer before keeping it;
  - every cache write after a Save, which is guarded by `isCurrent()`.
- Any successful sign-in now consumes the armed Save. It is completed for its own nonce and dropped
  otherwise; before, a cancelled sign-in's Save stayed armed until sign-out (ON-104). Sign-out still
  clears it with the query cache.
- An expired session (401 SESSION_EXPIRED) on the continuation signs out and saves nothing.
- Nothing is persisted: the pending Save stays in memory (Zustand) and the bearer stays in
  SecureStore, as before.

## 5. Guest continuation behaviour

- **From Product Detail or Explore the Scene:** unchanged from WO-009.
- **From a card, as a guest:**
  1. The bookmark is a plain button. Tapping it shows an alert, "Sign in to save." and "Sign in to
     save Products and Scenes to your private collections. This item opens, and once you have
     signed in it is saved if it is still available.", with Cancel and Sign in. Nothing is stored
     on the device and no anonymous Collection exists.
  2. Sign in arms the Save in memory with the card's surface (SHOP, SEARCH or SELLER_PROFILE).
     It opens the item's own screen, then the sign-in over it.
  3. The finished sign-in returns to that screen, which shows Saved once the server has the Save.
     Back returns to the list (review R2).
  4. If the target stopped being public, the server refuses and nothing is saved.
- **Links and returns:** a link cannot save, because an unknown nonce does nothing. A cancelled
  sign-in saves nothing. `returnTo` accepts only the allowlisted shapes, so there is no open
  redirect.

## 6. Tests

**Gates.** The full battery ran on a freshly rebuilt disposable database, on the working tree before
the review fixes:

| Gate | Result |
|---|---|
| `@adulis/api` jest, `--maxWorkers=2` (ON-085) | 969/969 |
| `pnpm test` at default parallelism | api 969/969, mobile 278/278 |
| `@adulis/api-client` test, generate:check | PASS, PASS |
| mobile typecheck, test, build; `pnpm typecheck`, `lint`, `build` | PASS (all six) |
| verify:contract, appendix, docs, deps, mt-keys, error-locale | PASS (all six) |
| db:check, db:determinism, orphan sweep | 16/16, PASS, PASS |
| Expo Doctor 1.21.6 (ON-102: 1.21.7 is still the latest on npm and still broken) | 20/20 |
| Bundle scan for subscription copy | framework identifiers only (event and keyboard `Subscription` APIs) |

After the independent-review fixes (mobile, locale and script only; the API and database
unchanged), these were re-run: mobile typecheck, test (279/279), build; `pnpm typecheck`, `lint`;
verify:docs, deps, mt-keys, error-locale; the storage script self-test. All passed.

**Matrix (WO-009A S16).** The numbers are the work order's.
- In `card-saves.test.tsx` (17 tests):
  - batching: 1-7 and Retry;
  - Shop: 8, 9, 10, 11;
  - Search: 12, 13;
  - Seller Profile: 14, 15;
  - navigation, offline, refusal, double tap: 16-20;
  - an alert once per failure (review R1);
  - the guest from a card: 21 and Back to the list (R2);
  - a late answer for Account A never reaching the guest or Account B: 26, 27.
- In `saved.test.tsx` (+3): 25 and 26 (the continuation sends nothing after a sign-out and
  another sign-in), 24 (expired session), 22 (cancelled sign-in).
- Existing tests, still green:
  - 21 and 23: unknown nonce, unsafe returnTo, guest flow;
  - 28-32: Product Detail Save, Scene Explorer Save, the Saved tab, the picker, named Collections;
  - 33-36: the search, shop, seller-profile and for-you suites.
- 37 (no Cart, Order, Checkout, payment or reservation request) is asserted after every test in
  both files.
- The same-frame double tap is guarded by a ref. A test cannot press twice inside one frame; the
  in-flight second tap is tested.

## 7. Native validation

Android emulator (API 37, Pixel 8a image), debug build reused (no native dependency changed), Metro
serving the branch, real local API on the disposable database with the WO-CAT-001/006/007 fixtures.
**iOS was not tested.**

| Flow (final pass, fixed bundle) | Result |
|---|---|
| `card-saves-guest` + `card-saves-guest-2`: guest Shop card, prompt, Cancel (card not opened, nothing saved), Sign in, code, the Product shown Saved, Back to the Shop with the card saved | PASS (database: nothing before sign-in; afterwards one DEFAULT membership, source SHOP) |
| `card-saves` shop: Remove and Save on the card, still on the Shop, Saved lists it | PASS |
| `card-saves` search: Top row Save, Products grid shows the same state and removes it, Scenes grid saves a Scene | PASS |
| `card-saves` seller: the Scene saved in Search shown saved; the other Scene and the Woven basket saved from their cards | PASS (database: SEARCH:scene, SELLER_PROFILE:scene, SELLER_PROFILE:product) |
| Account switch: sign out A (`saved-states signed-out`), sign in B, `card-saves` account-b: nothing of A's shown, Saved 0/0 | PASS (database: B has an empty DEFAULT only) |
| `card-saves` dark: Dark at font scale 1.3, Save and Remove on the card | PASS |
| Regressions: WO-009 `saved-guest-1/2` and `saved-collections` (Product Detail and Scene Explorer Save, the picker, rename, remove, delete), `search`, `shop`, `seller-profile`, `buyer-scene-explorer`, `catalogue-product-1` | PASS (second pass, fixed bundle) |
| Commerce rows after all passes | carts 0; reservations 5 and orders 8 are seed and fixture rows, unchanged |

- Three passes ran. The first used the pre-review bundle and all its flows passed. In the second
  the guest flow failed on its own outdated prompt text, so its signed-in steps never ran; the
  rest passed. The third re-ran the cards and the real A-to-B switch on the fixed bundle.
- `buyer-for-you.yaml` was not run (ON-084). For You is covered by its Jest suites and by
  `buyer-scene-explorer`, which starts in For You.

## 8. Security review (WO-009A S18)

An independent review of the diff found no Critical or High issue. Its four findings were fixed:
R1 MEDIUM, and R2, R3 and R4 LOW (section 9). Verdict per point, after the fixes:

| Point | Verdict |
|---|---|
| Collection IDOR | fine: refs come only from the same session's answers; the server checks ownership |
| Cross-account saved-state | fine: every read bound to its session; the cache is cleared at every session end |
| Session switching, stale authentication | fixed (ON-103); verified by tests and on the device |
| Guest Save continuation | fixed (ON-104, R2); nonce-bound; no open redirect |
| PRIVATE Scene visibility | fine: saved-state answers carry no content; cards show only public list payloads |
| Invalid target references | fine: targets come from server payloads; a refusal is said and redrawn |
| Concurrent Save/Remove | fine: one request per control; the server membership is idempotent; in-flight reads re-sent (R3) |
| Query-cache isolation | fine: page keys can only collide on identical answers; gcTime 0 |
| Private-data logging | fine: error names only |
| Reused idempotency keys | fine: a new key per tap and per continuation (unchanged from WO-009 D3) |
| Accidental navigation | fine: a sibling control; tested and checked on the device |

Not changed (ON-112): the picker and the Collection screen still send through the session's
client, not a bound one. The server scopes them to the bearer's Account and a switch needs a full
sign-out, so the risk is low.

## 9. Bugs found and fixed

| ID | Severity | Bug | Fix |
|---|---|---|---|
| ON-20261111-103 | MEDIUM | the continuation could send its mutation with a newer Account's bearer | session-bound client (051defe, 76ec748) |
| ON-20261111-104 | LOW | an armed guest Save outlived a cancelled sign-in until sign-out | consumed by any sign-in (76ec748) |
| ON-20261111-105 | MEDIUM | (review R1) a failed Save's alert came back on every re-render | once per failure (5be3273) |
| ON-20261111-106 | LOW | (review R2) after a card's guest Save, Back reopened the Product | open the item, then the sign-in (5be3273) |
| ON-20261111-107 | LOW | (review R3) a read in flight could overwrite a confirmed Save | in-flight reads re-sent (76ec748) |
| ON-20261111-108 | LOW | review minor items: retry repeating requests, the guest control's role, a stale comment, an alert on a session change, the script aborting on a failed delete | fixed (5be3273, 76ec748, de344d1) |
| ON-20261111-109 | MEDIUM | Maestro's driver APKs under new names had built up unseen (485, 2.86 GB) | recognised by the audit and cleaned (de344d1) |

Found by me while building, before commit:
- A FlashList recycled cell could carry another card's in-flight Save. The control is now keyed by
  its target.
- Two test-harness issues: FlashList's Jest setup renders every row, and the fake server had no
  Scene to resolve.

## 10. Remaining issues

- Founder decisions, unchanged:
  - ON-087, ON-088, ON-090, ON-091;
  - the C: storage items ON-110 (page file and memory) and ON-111 (pip leftovers, Docker build
    cache, G: copies).
- ON-112: the picker and the Collection screen are not bound.
- ON-113: the `packages/locale` change is its own commit on this branch, but the repository rule
  asks for its own PR.
- ON-084 (For You flow timeout) and ON-085 (memory): unchanged, still open. ON-102: still pinned.
- C: ends with 9.65 GB free, below the policy's 10 GB floor for the next native battery (ON-100).
- Amharic strings are machine-translated placeholders.
- For You cards have no Save, as WO-009A S4 requires.

## 11. Files changed

- Mobile:
  - `apps/mobile/src/auth/session.tsx`, `app/(buyer)/auth/verify.tsx`;
  - `buyer/saved.ts`, `public-list.ts`, `PublicListView.tsx`;
  - `CardSaveButton.tsx` (new), `SaveButton.tsx`, `SearchResults.tsx`, `SellerProfile.tsx`,
    `CollectionScreen.tsx`;
  - `app/(buyer)/(tabs)/shop.tsx`.
- Tests: `card-saves.test.tsx` (new), `saved.test.tsx`, `testing/fake-collections.ts`; three Maestro
  flows (new).
- `packages/locale` (five keys, MT-KEYS).
- `ops/scripts/adulis-storage-audit.ps1` (new).
- `docs/engineering/` (policy and audit, new); `CLAUDE.md` (storage rule); this record; the register.

## 12. Commits

`72efade` locale - `051defe` session-bound continuation - `76ec748` batched card saved-state -
`5be3273` discovery card Save - `8caa090` tests - `de344d1` storage audit - `e915242` storage policy
- then the handoff commit with this record, the storage audit and the register.
