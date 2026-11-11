# WO-009 -- Collections: cross-surface handoff (11 November 2026)

For whoever builds Save on another surface next: the Seller Storefront website, Shop / Search / Seller
Profile / For You cards in the Mobile App, or a later Buyer surface. This describes the contract WO-009
shipped and the rules a client must keep. No other application was changed by WO-009.

Contract source of truth: `contracts/openapi.json` (generated) and `@adulis/api-client`. Engineering
record: `docs/mobile/WO-009-BUYER-SAVED-COLLECTIONS.md`.

## The rules every surface keeps

1. **Signed in only.** Every Collections endpoint needs an authenticated ordinary Account session (401
   otherwise). There is no anonymous or device-held Collection, and a client must not keep one (ADU-SRC-01
   v3.2 S18, S26). A guest who taps Save is told why and offered sign-in.
2. **The owner is the session.** Never send an owner, Account or device id; the API refuses unknown keys.
   Mode (Buyer, Seller Companion, Courier) and `X-Adulis-Seller` change nothing.
3. **Saving is not buying.** No quantity, hold, price freeze, Cart or Order follows a Save (MOB-02 S42).
4. **Draw only what the server answered.** Show Saved after the 201, not before; show items exactly as
   `GET` resolves them now.
5. **Unavailable means nothing else.** An item with `state: UNAVAILABLE` has `product` and `scene` null:
   show "This Product is no longer available." / "This Scene is no longer available." and Remove. Never
   fill it from a cache, a feed unit or an earlier answer; a PRIVATE Scene's caption and image must not
   appear anywhere.
6. **One batch per page, never one request per card.** Use `POST /v1/collections/saved-state:batch` with
   up to 60 typed targets for the visible page.
7. **Private and uncached.** Responses are `no-store`; keep them only in memory for the session and drop
   them on sign-out. On the web, never in localStorage, a service worker or a shared cache.

## Targets

| Type | `ref` | Where a client gets it |
|---|---|---|
| `PRODUCT_POST` | the Product `id` (uuid) | every public Product payload (`StorefrontProductDto`, `ShopProductDto`, Search Product items) |
| `SCENE_POST` | the Scene `public_ref` | Scene payloads, For You units, Search Scene items |

There is no global Product slug: never build a target from a handle and slug. A Product `id` goes in a
request body, never in a URL path.

## Endpoints

| Call | Use |
|---|---|
| `POST /v1/collections/saved-state:batch` `{ targets }` | The Save button state for a page; also gives `default_collection_ref` and, per target, `default_item_ref` (to Unsave) and every membership |
| `POST /v1/collections/{default_collection_ref}/items` `{ target, source_surface, context? }` + Idempotency-Key | Save (one tap). A repeated Save answers the same membership |
| `DELETE /v1/collections/{default_collection_ref}/items/{default_item_ref}` | Unsave (idempotent) |
| `GET /v1/collections` | The Collection list (DEFAULT first; created on first need) for a picker or a Saved page |
| `POST /v1/collections` `{ name }` + Idempotency-Key | New Collection (answers `{ ref }` only) |
| `GET /v1/collections/{ref}`, `PATCH`, `DELETE` | Open, rename, delete a named Collection (DEFAULT can be neither renamed nor deleted) |
| `GET /v1/collections/saves?type=` | Recent Saves / Saved Products / Saved Scenes across Collections |

- `source_surface`: `PRODUCT_DETAIL`, `SCENE_EXPLORER`, `SEARCH`, `SHOP`, `SELLER_PROFILE`, `FOR_YOU`,
  `SAVED`. A new surface (for example the web Storefront) needs a new value: that is a migration and a
  contract change, not a client choice -- ask for it; do not reuse a wrong value.
- `context.scene_ref`: send it when a Product was opened from a Scene. The server records it only when the
  Scene's current public revision tags that Product; never invent it.
- Idempotency-Key: a fresh UUIDv7 per tap. The membership is idempotent on the server; a key reused across
  a lost answer can replay a membership removed since (WO-009 review D3).
- Errors: 404 for a foreign, forged or hidden target or Collection (indistinguishable by design); 400 for
  malformed input; render through `message_key` and slots, never server English.

## Web Storefront specifics (when it is built)

- Sign-in continuation must be typed and allowlisted like the Mobile App's (`parseReturnTo` and an
  in-memory nonce, `apps/mobile/src/auth/sign-in-flow.ts`, `src/buyer/saved.ts`): never an arbitrary
  `returnTo` URL, never a Save triggered by a link alone, nothing saved if sign-in is cancelled.
- Console-audience cookies authenticate the console; a Buyer website session audience for Collections is
  an open contract question (the Storefront's own work order must settle it with ADU-AUTH-02).

## Not available yet (do not build around)

Public, shared or collaborative Collections; reordering; restock alerts; Collection analytics or ranking
signals (SRC-01 S24 needs privacy approval first); per-Account caps (ON-20261111-088). Open founder items:
ON-087 (deleted-Collection retention), ON-088 (bounds), ON-090 (tombstone after a Seller's hard delete),
ON-091 (Market-specific unavailable text).
