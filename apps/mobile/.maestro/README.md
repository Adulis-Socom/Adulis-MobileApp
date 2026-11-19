# Maestro flows

The 54 native flows for the Buyer app (`appId: com.adulis.app`). They are Android flows: they grant
Android permissions in `launchApp` and some press the Android back key. Each flow's header comment
is the authority for what it checks; this file says what each flow needs.

## Before any flow

**Test devices only.** 28 flows clear the app's data (`clearState: true`) on whatever
`com.adulis.app` is installed, and none checks that it is a debug build: never run them on a phone
with a real install. The native driver (`ops/native`, below) refuses a device that is not an emulator
or an allow-listed disposable test device, and an app that is not a debug build, before any flow runs.

**No flow runs without the API.** Every flow waits for an API answer on its first screen.

**The approved flows are declared, not discovered.** `ops/native/flows.json` names the flows the
native driver may run (today `foundation-smoke` and `buyer-shell`, the `smoke` battery) and declares
what each does to the device (clears the app's data, grants a permission). It also pins the SHA-256
of each flow file: the driver hashes the file again right before every Maestro start and refuses any
flow whose content differs from its pin, and a flow that is not declared. Changing an approved flow, or
adding one to a battery, is a change to that declaration, and the scan a reviewer sees when a pin is set
refuses scripts and expressions, file loads, external links, cloud services, another app id and hardware
keys other than navigation keys, whatever the declaration says.

**Only the baseline fixtures are in this repository.** Almost every flow asserts named fixture content
(Seller "Fixture Weaves", `fixture-weaves`, and its Products and Scenes). The baseline set in
`ops/native/fixtures` (an Account and a Device row, one category) is all the two approved flows need.
The rest is not ported yet:

- the catalogue fixtures (Fixture Weaves, its Products and two Scenes, and a second Market,
  "Market B", with its own `fixture-weaves`), the extra fixtures (three unverified reviews; a second
  Seller, "Fixture Pottery", with 32 "Shop item NN" Products), and the For You fixtures (twelve
  Scenes);
- the Seller-API steps between parts (unpublish, publish, price, stock);
- the category assignments, the chat assistant intent, the notification rows, the long Product
  names and the seeded chat messages;
- the fixture images.

Only these flows assert no fixture content (they may still need other setup): `foundation-smoke`,
`buyer-shell`, the four `buyer-auth-*` flows, `account`, `account-delete`, `shop-offline-1`,
`shop-no-market-1`. Every other flow needs fixture data that is not ported yet.

## The database: two options

**Never the database in the root `.env`** (`adulis`): `.env.example` points it at the persistent
development database, and the flows create Accounts, saves and messages (`account-delete` really
deletes an Account).

**Option 1 - the native harness (the path the driver uses).** `ops/native` starts a PostgreSQL, a MinIO
and the API of its own for each run, on loopback ports it picks, with random credentials, and removes
only what it created. See `ops/native/README.md`. In short, from the repository root:

```
export ADULIS_NATIVE_ROOT=<an existing absolute dir outside any git work tree>
node ops/native/harness.mjs up --checkout . --sha <the commit you verified>
node ops/native/harness.mjs fixtures --run <run> --set baseline
node ops/native/harness.mjs api start --run <run> --checkout . --sha <sha>
node ops/native/harness.mjs metro start --run <run> --checkout . --sha <sha>
node ops/native/harness.mjs native conditions --run <run> --serial <serial> --checkout . --sha <sha> \
    --apk <debug apk> --built-at <commit the apk was built at>
node ops/native/harness.mjs native run <the same options>
node ops/native/harness.mjs metro stop --run <run>; node ops/native/harness.mjs api stop --run <run>
node ops/native/harness.mjs down --run <run>
```

**Option 2 - a fully isolated pair, with NO fixtures.** `ops/scripts/test-db.sh` starts a disposable
PostgreSQL (port 55432) and MinIO (port 59000), migrated, seeded and marked disposable. It holds only
migrations and the seed, so every fixture-dependent flow fails. The native harness does not use this
pair. From the repository root:

```
set -a; . ./.env; set +a                        # pnpm dev:api does not load .env itself
bash ops/scripts/test-db.sh up                  # a disposable pair, marked disposable
eval "$(bash ops/scripts/test-db.sh env)"       # its URLs, in THIS shell, AFTER .env: they win
node ops/scripts/assert-disposable-db.mjs       # must PASS for every URL before the API starts
NODE_ENV=development pnpm dev:api               # from the same shell
```

With option 2 the media origin is `http://127.0.0.1:59000/adulis-media`, so images need
`adb reverse tcp:59000 tcp:59000`, which you run yourself: the native driver never reverses that port.
Remove the pair with `bash ops/scripts/test-db.sh down`.

## Then, on the device

With option 1 the driver does these three things itself; they are listed for a manual run.

1. **The app.** A debug build of `com.adulis.app` whose native dependencies match this branch
   (`apps/mobile/package.json` dependencies and `app.json` unchanged since the build). It loads JS
   from Metro. The driver checks that the installed APK is the file you name, that its architecture is
   the device's, and that those two files did not change since the commit you say it was built at.
2. **Metro with the API origin.** `metro start` runs it from `apps/mobile` with
   `EXPO_PUBLIC_API_BASE_URL=http://localhost:<this run's API port>`. Without the variable every screen
   shows the generic error. CI mode does not reload: restart Metro after a JS change.
3. **adb reverse.** `device prepare` (or `native run`) reverses this run's API port, its MinIO port and
   `tcp:8081` (Metro), and records each entry so that `device restore` removes exactly those.

The flows grant `ACCESS_LOCAL_NETWORK` (Android 17 debug builds need it to reach Metro).

## Run-order rules

- **`foundation-smoke.yaml` first** after every database rebuild. It clears state, so the app
  registers a new device. Otherwise Home shows "The request is not valid." (a stale device id).
- **`buyer-for-you`, `buyer-for-you-background-1` and `-2` need their own rebuilt database** with
  the For You fixtures (twelve Scenes, the newest captioned "... (12)"). Those fixtures and the
  catalogue fixtures both create `fixture-weaves`.
- A "continues" flow below must run right after the flow it names, without clearing state.
- A flow that ends on a cleared install leaves a guest: sign in before a signed-in step.
- `account-delete.yaml` STEP `confirm` really deletes the Account: disposable Accounts only.

## OTP codes

There is no SMS vendor. The API's fake SMS adapter appends every sign-in and deletion code to
`apps/api/.dev-sms.log` in the checkout that runs the API (only when NODE_ENV is `development` or
`staging`; never on stdout). **The file is emptied every time the API starts**: read a code after
its request and before any API restart. Take the newest six-digit code for the phone and pass it as
`OTP`. Example (bash, from the root of the checkout that runs the API):

```
grep -F "+251911600001" apps/api/.dev-sms.log | tail -1 | grep -oE '"[0-9]{6}"' | tr -d '"'
```

Each step needs only its own value: the step that requests a code takes `PHONE`, the step that
enters it takes `OTP` (for example `account-delete` STEP `request` takes `PHONE`, STEP `confirm`
takes `OTP`). Use a new disposable phone (E.164) for every run: a new phone is a new Account (the age
declaration appears) and avoids per-phone code limits. Never a real person's number.

## Variables

| Variable             | Meaning                                                                             |
| -------------------- | ----------------------------------------------------------------------------------- |
| `PHONE`              | Disposable E.164 phone, for example `+251911600001`                                 |
| `OTP`                | The newest code for that phone from the SMS log                                     |
| `DIGITS`             | The same phone without `+` (used in `adulis://auth/verify?phone=%2B${DIGITS}`)      |
| `STEP`               | Which step of a multi-step flow to run                                              |
| `REF`, `PRIVATE_REF` | A Scene `public_ref` from the fixtures (see the flow header for which Scene)        |
| `EXPECT`, `SHOT`     | `catalogue-product-refresh.yaml`: the expected text (regex) and the screenshot name |

Command form of a manual run, on a disposable emulator only and never through the native driver's
checks: `maestro --device <emulator serial> test -e KEY=VALUE --test-output-dir <dir> .maestro/<flow>.yaml`.
Name the serial every time, so that the run cannot go to another attached device.

## Flow index

"Between" is a backend step done outside Maestro by the harness, on the disposable database or
through the Seller API. "Dark + font" means Dark mode and a font scale (for example 1.3) set with
adb before the step (`adb shell cmd uimode night yes`, `adb shell settings put system font_scale
1.3`); put both back after.

| Flow(s)                                                                          | Env                                                                                                                                                  | Starts                                                            | Needs; between the parts                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `foundation-smoke`                                                               | -                                                                                                                                                    | clears state                                                      | Run first. Opens the development-only diagnostics.                                                                                                                                                                                                                                                                                                                         |
| `buyer-shell`                                                                    | -                                                                                                                                                    | clears state                                                      | Guest. Sets Dark in the app and back.                                                                                                                                                                                                                                                                                                                                      |
| `buyer-auth-request` -> `buyer-auth-verify`                                      | `PHONE`; `OTP`                                                                                                                                       | clears state; continues                                           | Between: read the code for `PHONE`. Verify signs in, restores after a cold relaunch, then signs out.                                                                                                                                                                                                                                                                       |
| `buyer-auth-verify-link`                                                         | `DIGITS`                                                                                                                                             | clears state                                                      | Afterwards check the SMS log gained no line for `+DIGITS`.                                                                                                                                                                                                                                                                                                                 |
| `buyer-auth-leave-verify`                                                        | `DIGITS`                                                                                                                                             | continues `buyer-auth-request`                                    | Same phone as the request.                                                                                                                                                                                                                                                                                                                                                 |
| `buyer-for-you`                                                                  | -                                                                                                                                                    | clears state                                                      | For You database (twelve Scenes).                                                                                                                                                                                                                                                                                                                                          |
| `buyer-for-you-background-1` -> `-2`                                             | -                                                                                                                                                    | clears state; continues                                           | For You database (twelve Scenes). Between: make the newest Scene PRIVATE and stay in the background longer than the freshness interval (5 minutes in a development build).                                                                                                                                                                                                 |
| `buyer-scene-explorer`                                                           | -                                                                                                                                                    | clears state                                                      | Guest; catalogue fixtures.                                                                                                                                                                                                                                                                                                                                                 |
| `buyer-scene-explorer-dark`                                                      | -                                                                                                                                                    | clears state                                                      | Catalogue fixtures. Sets Dark in the app; run at font scale 1.0 and 1.3.                                                                                                                                                                                                                                                                                                   |
| `buyer-scene-explorer-link`                                                      | `REF`                                                                                                                                                | clears state                                                      | Catalogue fixtures. Cold link and a malformed link.                                                                                                                                                                                                                                                                                                                        |
| `buyer-scene-explorer-private-1` -> `-2`                                         | `PRIVATE_REF`                                                                                                                                        | clears state; continues                                           | Between: Coffee tray stock to 0 through the Seller API (the Scene goes PRIVATE).                                                                                                                                                                                                                                                                                           |
| `buyer-scene-explorer-background-1` -> `-2`                                      | `PRIVATE_REF`                                                                                                                                        | clears state; continues                                           | Between: the same stock change, and stay away past the interval.                                                                                                                                                                                                                                                                                                           |
| `catalogue-product-1` -> `catalogue-product-refresh` -> `catalogue-product-back` | -; `EXPECT`, `SHOT`; -                                                                                                                               | clears state; continues                                           | Catalogue fixtures including Market B. Before refresh: a Seller API change (stock, price or publication). Before back: unpublish the Product.                                                                                                                                                                                                                              |
| `catalogue-product-link`                                                         | -                                                                                                                                                    | clears state                                                      | Malformed, unknown and valid Product links.                                                                                                                                                                                                                                                                                                                                |
| `catalogue-signed-in`, `shop-signed-in`, `search-signed-in`                      | -                                                                                                                                                    | continues a sign-in                                               | Start signed in; the first two sign out at the end.                                                                                                                                                                                                                                                                                                                        |
| `shop`                                                                           | -                                                                                                                                                    | clears state                                                      | Guest. Catalogue fixtures including Market B, plus the extra fixtures (Fixture Pottery, 32 Products: two pages).                                                                                                                                                                                                                                                           |
| `shop-refresh-1` -> `-2` -> `-3`                                                 | -                                                                                                                                                    | clears state; continues                                           | Before 2: unpublish the Clay cup. Before 3: republish it and reprice the Woven basket's Small Variant to 950.00.                                                                                                                                                                                                                                                           |
| `shop-offline-1` -> `-2`                                                         | -                                                                                                                                                    | clears state; continues                                           | Part 1 with the API stopped. Between: start the API.                                                                                                                                                                                                                                                                                                                       |
| `shop-no-market-1` -> `-2`                                                       | -                                                                                                                                                    | clears state; continues                                           | Between: clear the device's Market in the disposable database.                                                                                                                                                                                                                                                                                                             |
| `categories`                                                                     | `STEP` = `shop`, `search`, `save`, `dark`                                                                                                            | `shop`, `search` clear state                                      | Catalogue and extra fixtures plus the harness's category assignments. `save` and `dark` signed in; `dark`: Dark + font.                                                                                                                                                                                                                                                    |
| `search`                                                                         | -                                                                                                                                                    | clears state                                                      | Guest. Catalogue fixtures including Market B, plus the extra fixtures.                                                                                                                                                                                                                                                                                                     |
| `seller-profile`                                                                 | -                                                                                                                                                    | clears state                                                      | Guest. Catalogue fixtures including Market B, plus the extra fixtures (three unverified reviews, never shown). Payment stand-in OFF.                                                                                                                                                                                                                                       |
| `seller-profile-private-1` -> `-2`                                               | -                                                                                                                                                    | clears state; continues                                           | Between: Coffee tray out of stock (the Scene goes PRIVATE).                                                                                                                                                                                                                                                                                                                |
| `seller-reviews-verified` -> `seller-reviews-withdrawn`                          | -                                                                                                                                                    | clears state; continues                                           | **STAND-IN RESULTS, never real successes.** Need verified-review fixtures and a payment stand-in switched ON (`wo007a-fixtures`, `wo007a-payment.mjs`); between: stand-in OFF. The backend has no verified payment yet, so without the stand-in no review is public. Those scripts are not in this repository and are currently missing: these flows cannot be reproduced. |
| `saved-guest-1` -> `saved-guest-2` -> `saved-collections`                        | `PHONE`; `OTP`; -                                                                                                                                    | clears state; continues                                           | Between 1 and 2: read the code.                                                                                                                                                                                                                                                                                                                                            |
| `card-saves-guest` -> `card-saves-guest-2`                                       | `PHONE`; `OTP`                                                                                                                                       | clears state; continues                                           | Between: read the code. The header of `card-saves-guest.yaml` names its part 2 as `saved-guest-2.yaml`: stale; part 2 is `card-saves-guest-2.yaml`.                                                                                                                                                                                                                        |
| `card-saves`                                                                     | `STEP` = `shop`, `search`, `seller`, `account-b`, `dark`                                                                                             | continues `card-saves-guest-2`                                    | `account-b`: another Account signed in first; `dark`: Dark + font.                                                                                                                                                                                                                                                                                                         |
| `saved-states`                                                                   | `STEP` = `unavailable`, `signed-out`, `back`, `dark`                                                                                                 | keeps state                                                       | `unavailable`: Woven basket unpublished first. `back`: signed in again on a fresh install. `dark`: Dark + font.                                                                                                                                                                                                                                                            |
| `account`                                                                        | `STEP` = `guest`, `signed-in`, `sign-out`                                                                                                            | `guest` clears state                                              | `signed-in` after a sign-in flow.                                                                                                                                                                                                                                                                                                                                          |
| `account-delete`                                                                 | `STEP` = `request` (`PHONE`), `cancel`, `confirm` (`OTP`)                                                                                            | signed in                                                         | `PHONE` is the signed-in Account's phone. Between `request` and `confirm`: read the deletion code. `confirm` deletes the Account.                                                                                                                                                                                                                                          |
| `notifications`                                                                  | `STEP` = `guest`, `read`, `view`                                                                                                                     | `guest` clears state                                              | `read`, `view`: a signed-in Account with notification rows inserted on the disposable database first. **Fixture rows**, not real activity. `view`: Dark + font.                                                                                                                                                                                                            |
| `messaging`                                                                      | `STEP` = `guest`, `open`, `reopen`, `view`, `empty`                                                                                                  | `guest` clears state                                              | A disposable assistant intent ("Delivery times?") for Fixture Weaves: the automated answer is **fixture-driven**. `view`: Dark + font.                                                                                                                                                                                                                                     |
| `messaging-layout`                                                               | `STEP` = `seed`, `view`, `open`, `offline`, `retry`                                                                                                  | signed in                                                         | After `seed`: 30 history messages written to the conversation; Dark + font set. Between `open` and `offline`: stop the API. Before `retry`: start it.                                                                                                                                                                                                                      |
| `product-context-messaging`                                                      | `STEP` = `guest` (`PHONE`), `guest-in` (`OTP`), `c-open`, `ask-a`, `ask-b`, `d-open`, `d-send`, `off-open`, `off-send`, `off-retry`, `view`, `other` | `guest` clears state                                              | Between `d-open` and `d-send`: unpublish the Clay cup. After `off-open`: stop the API. Before `off-retry`: start it. `view`: Dark + font.                                                                                                                                                                                                                                  |
| `conversation-product-selector`                                                  | `STEP` = `seed`, `select`, `select2`, `view`                                                                                                         | signed in                                                         | `view`: Dark + font.                                                                                                                                                                                                                                                                                                                                                       |
| `buyer-journeys`                                                                 | `STEP` = `j1` .. `j5`                                                                                                                                | signed in (new Account)                                           | `j2` needs the harness's category assignments.                                                                                                                                                                                                                                                                                                                             |
| `accessibility-completion`                                                       | `STEP` = `shop-open`, `shop-fail`, `shop-retry`, `names`, `seller-tabs`, `collections`, `delete-request` (`PHONE`), `delete-preview` (`OTP`)         | `collections`, `delete-request`, `delete-preview` start signed in | Font scale and theme set by the harness. `shop-fail` with the API stopped, `shop-retry` with it started. `names`: two fixture Products renamed to long names (English and Ge'ez) first. `delete-preview` cancels; it never deletes.                                                                                                                                        |

## Results that are not real successes

| Seen in a flow                                                           | What it is                                                                 |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| A public Seller review (`seller-reviews-*`)                              | Stand-in: needs the payment stand-in                                       |
| Notification rows (`notifications`)                                      | SQL-inserted fixture rows; one generic sentence                            |
| An automated chat answer (`messaging`)                                   | A fixture intent                                                           |
| Chat history in the messaging flows                                      | SQL-inserted fixture messages, half of them Seller messages no Seller sent |
| A sign-in code                                                           | Read from the SMS log file; no SMS is sent                                 |
| Anything shown while Metro points at the contract mock (`pnpm mock:api`) | Contract examples                                                          |
