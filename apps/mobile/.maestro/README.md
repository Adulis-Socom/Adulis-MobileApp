# Maestro flows

The 54 native flows for the Buyer app (`appId: com.adulis.app`). They are Android flows: they grant
Android permissions in `launchApp` and some press the Android back key. Each flow's header comment
is the authority for what it checks; this file says what each flow needs.

## Before any flow

**No flow runs without the API.** Every flow waits for an API answer on its first screen. Run the
real local API (`pnpm dev:api`, NODE_ENV=development) on a DISPOSABLE database loaded with the review
fixtures (Seller `fixture-weaves`, "Fixture Weaves"). Then:

1. **The app.** A debug build of `com.adulis.app` whose native dependencies match this branch
   (`apps/mobile/package.json` dependencies and `app.json` unchanged since the build). It loads JS
   from Metro.
2. **Metro with the API origin.** From `apps/mobile`:
   `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000 CI=1 npx expo start --port 8081`.
   Without the variable every screen shows the generic error. CI mode does not reload: restart
   Metro after a JS change.
3. **adb reverse.** `adb reverse tcp:3000 tcp:3000` (API), `tcp:8081 tcp:8081` (Metro),
   `tcp:9100 tcp:9100` (local media).

The flows grant `ACCESS_LOCAL_NETWORK` (Android 17 debug builds need it to reach Metro).

## Run-order rules

- **`foundation-smoke.yaml` first** after every database rebuild. It clears state, so the app
  registers a new device. Otherwise Home shows "The request is not valid." (a stale device id).
- **`buyer-for-you.yaml` needs its own rebuilt database** with the For You fixtures. Those fixtures
  and the catalogue fixtures both create `fixture-weaves`.
- A "continues" flow below must run right after the flow it names, without clearing state.
- A flow that ends on a cleared install leaves a guest: sign in before a signed-in step.
- `account-delete.yaml` STEP `confirm` really deletes the Account: disposable Accounts only.

## OTP codes

There is no SMS vendor. In development the API's fake SMS adapter appends every sign-in and
deletion code to `apps/api/.dev-sms.log` (only when NODE_ENV is exactly `development`; never on
stdout). Take the newest six-digit code for the phone and pass it as `OTP`. Example (bash, from the
repository root):

```
grep -F "+251911600001" apps/api/.dev-sms.log | tail -1 | grep -oE '"[0-9]{6}"' | tr -d '"'
```

Use a new disposable phone (E.164) for every run: a new phone is a new Account (the age
declaration appears) and avoids per-phone code limits. Never a real person's number.

## Variables

| Variable | Meaning |
|---|---|
| `PHONE` | Disposable E.164 phone, for example `+251911600001` |
| `OTP` | The newest code for that phone from the development SMS log |
| `DIGITS` | The same phone without `+` (used in `adulis://auth/verify?phone=%2B${DIGITS}`) |
| `STEP` | Which step of a multi-step flow to run |
| `REF`, `PRIVATE_REF` | A Scene `public_ref` from the fixtures (see the flow header for which Scene) |
| `EXPECT`, `SHOT` | `catalogue-product-refresh.yaml`: the expected text (regex) and the screenshot name |

Command form: `maestro test -e KEY=VALUE --test-output-dir <dir> .maestro/<flow>.yaml`.

## Flow index

"Between" is a backend step done outside Maestro, on the disposable database or through the Seller API.

| Flow(s) | Env | Starts | Needs; between the parts |
|---|---|---|---|
| `foundation-smoke` | - | clears state | Run first. Opens the development-only diagnostics. |
| `buyer-shell` | - | clears state | Guest. |
| `buyer-auth-request` -> `buyer-auth-verify` | `PHONE`; `OTP` | clears state; continues | Between: read the code for `PHONE`. Verify signs in, restores after a cold relaunch, then signs out. |
| `buyer-auth-verify-link` | `DIGITS` | clears state | Afterwards check the SMS log gained no line for `+DIGITS`. |
| `buyer-auth-leave-verify` | `DIGITS` | continues `buyer-auth-request` | Same phone as the request. |
| `buyer-for-you` | - | clears state | Own rebuilt database (For You fixtures). |
| `buyer-for-you-background-1` -> `-2` | - | clears state; continues | Between: make the newest Scene PRIVATE and stay in the background longer than the freshness interval (5 minutes in a development build). |
| `buyer-scene-explorer` | - | clears state | Guest; catalogue fixtures. |
| `buyer-scene-explorer-dark` | - | | Run at font scale 1.0 and 1.3. |
| `buyer-scene-explorer-link` | `REF` | | Cold link and a malformed link. |
| `buyer-scene-explorer-private-1` -> `-2` | `PRIVATE_REF` | clears state; continues | Between: Coffee tray stock to 0 through the Seller API (the Scene goes PRIVATE). |
| `buyer-scene-explorer-background-1` -> `-2` | `PRIVATE_REF` | clears state; continues | Between: the same stock change, and stay away past the interval. |
| `catalogue-product-1` -> `catalogue-product-refresh` -> `catalogue-product-back` | -; `EXPECT`, `SHOT`; - | continues | Before refresh: a Seller API change (stock, price or publication). Before back: unpublish the Product. |
| `catalogue-product-link` | - | | Malformed, unknown and valid Product links. |
| `catalogue-signed-in`, `shop-signed-in`, `search-signed-in` | - | continues a sign-in | Start signed in; the first two sign out at the end. |
| `shop` | - | clears state | Guest. |
| `shop-refresh-1` -> `-2` -> `-3` | - | continues | Before 2: unpublish the Clay cup. Before 3: republish it and reprice the Woven basket's Small Variant to 950.00. |
| `shop-offline-1` -> `-2` | - | clears state; continues | Part 1 with the API stopped. Between: start the API. |
| `shop-no-market-1` -> `-2` | - | clears state; continues | Between: clear the device's Market in the disposable database. |
| `categories` | `STEP` = `shop`, `search`, `save`, `dark` | | Category fixtures. `save` and `dark` signed in; `dark`: Dark mode and enlarged text set first. |
| `search` | - | | Guest. |
| `seller-profile` | - | | Guest. |
| `seller-profile-private-1` -> `-2` | - | continues | Between: Coffee tray out of stock (the Scene goes PRIVATE). |
| `seller-reviews-verified` -> `seller-reviews-withdrawn` | - | continues | **STAND-IN RESULTS, never real successes.** Need verified-review fixtures and a payment stand-in switched ON (`wo007a-fixtures`, `wo007a-payment.mjs`); between: stand-in OFF. The backend has no verified payment yet, so without the stand-in no review is public. Those scripts are not in this repository and are currently missing: these flows cannot be reproduced. |
| `saved-guest-1` -> `saved-guest-2` -> `saved-collections` | `PHONE`; `OTP`; - | clears state; continues | Between 1 and 2: read the code. |
| `card-saves-guest` -> `card-saves-guest-2` | `PHONE`; `OTP` | clears state; continues | Between: read the code. |
| `card-saves` | `STEP` = `shop`, `search`, `seller`, `account-b`, `dark` | continues `card-saves-guest-2` | `account-b`: another Account signed in first; `dark`: Dark mode and enlarged text set first. |
| `saved-states` | `STEP` = `unavailable`, `signed-out`, `back`, `dark` | | `unavailable`: Woven basket unpublished first. `back`: signed in again on a fresh install. |
| `account` | `STEP` = `guest`, `signed-in`, `sign-out` | | `signed-in` after a sign-in flow. |
| `account-delete` | `STEP` = `request`, `cancel`, `confirm`; `PHONE`, `OTP` | signed in | Between `request` and `confirm`: read the deletion code. `confirm` deletes the Account. |
| `notifications` | `STEP` = `guest`, `read`, `view` | | `read`, `view`: a signed-in Account with notification rows inserted on the disposable database first. **Fixture rows**, not real activity. |
| `messaging` | `STEP` = `guest`, `open`, `reopen`, `view`, `empty` | | A disposable assistant intent ("Delivery times?") for Fixture Weaves: the automated answer is **fixture-driven**. |
| `messaging-layout` | `STEP` = `seed`, `view`, `open`, `offline`, `retry` | signed in | After `seed`: 30 history messages written to the conversation. Between `open` and `offline`: stop the API. Before `retry`: start it. |
| `product-context-messaging` | `STEP` = `guest`, `guest-in`, `c-open`, `ask-a`, `ask-b`, `d-open`, `d-send`, `off-open`, `off-send`, `off-retry`, `view`, `other`; `PHONE`, `OTP` | | Between `d-open` and `d-send`: unpublish the Clay cup. After `off-open`: stop the API. Before `off-retry`: start it. |
| `conversation-product-selector` | `STEP` = `seed`, `select`, `select2`, `view` | signed in | |
| `buyer-journeys` | `STEP` = `j1` .. `j5` | signed in (new Account) | |
| `accessibility-completion` | `STEP` = `shop-open`, `shop-fail`, `shop-retry`, `names`, `seller-tabs`, `collections`, `delete-request`, `delete-preview`; `PHONE`, `OTP` | | `shop-fail` with the API stopped, `shop-retry` with it started. `names`: two fixture Products renamed to long names (English and Ge'ez) first. `delete-preview` cancels; it never deletes. |

"Dark mode and enlarged text set first" means, for example:
`adb shell cmd uimode night yes` and `adb shell settings put system font_scale 1.3`. Put both back after.

## Results that are not real successes

| Seen in a flow | What it is |
|---|---|
| A public Seller review (`seller-reviews-*`) | Stand-in: needs the payment stand-in |
| Notification rows (`notifications`) | SQL-inserted fixture rows; one generic sentence |
| An automated chat answer (`messaging`) | A fixture intent |
| A sign-in code | Read from the development SMS log; no SMS is sent |
| Anything shown while Metro points at the contract mock (`pnpm mock:api`) | Contract examples |

A local review harness that automates these steps exists outside this repository (example location
on the founder's machine: `G:\AdulisDevelopment\tools\review\`). It is not required to read or run
a single flow.
