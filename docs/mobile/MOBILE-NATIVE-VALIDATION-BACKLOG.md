# Mobile native validation backlog

Native checks that are owed and **have not been executed**. Jest results are not native results. Each
row stays NOT EXECUTED until a run on a device or emulator records its outcome here, with the date,
the build and the evidence path. WO-019 is reserved for this work.

Before running: close other memory-heavy programs (WO-018 W18-02, W18-08: with a game running the
emulator took C: below 10 GB and exited twice). Use `G:\AdulisDevelopment\tools\review\morning-start.sh`
(`prepare`, `long-names`, `start`), the WO-018 harness `wo018-native.sh` and `talkback.sh`.

## From WO-018 (Buyer accessibility)

| Item | Status | Reference |
|---|---|---|
| TalkBack pass T1-T12 (Home, Shop, Product, Seller tabs, Saved, Add to collection, Search, Notifications, Messages, Product selector, You, Delete Account) | NOT EXECUTED | `WO-018-MANUAL-REVIEW-GUIDE.md` section 3 |
| W18-12: one column and full Product names from Android's 130% | NOT EXECUTED (fixed in code, Jest only) | `WO-018-ISSUES-AND-BLOCKERS.md` |
| W18-13: tab labels wrap instead of breaking at 160% | NOT EXECUTED (fixed in code, Jest only) | same |
| Long names at 100%, 130%, 160% and at 360 dp; image alignment | NOT EXECUTED | `wo018-native.sh names` |
| Shop next-page retry (Try again) and the end sentence | NOT EXECUTED (failure state verified natively; retry blocked) | `wo018-native.sh paging` |
| Delete Account step focus and spoken "Deleting" (to the preview, then Cancel) | NOT EXECUTED | `wo018-native.sh delete` |
| For You Load more Scenes | NOT EXECUTED | own rebuilt database (`wo014-native.sh foryou`) |
| Buyer regression journeys A-F (Discovery, Shop, Messaging with the selector, Collections, Account, Notifications) | NOT EXECUTED in WO-018 | `wo014-native.sh journeys notif selector layout regressions` |

## From WO-020 (Seller Companion foundation)

The review data's store owner is the `fixture-weaves` owner (`prepare` creates it); sign in with
its phone and the launcher's `code` command. Disposable data only.

| Item | Status | What to check |
|---|---|---|
| Seller mode navigation | NOT EXECUTED | You shows Switch to Seller only for an Account with a store; a Buyer-only Account sees none; Switch to Buyer returns; Android back |
| Store selection | NOT EXECUTED | One store opens directly; several show the chooser (needs a second store in the data); Change store |
| Overview | NOT EXECUTED | The counts and their labels match `GET /v1/seller/analytics/overview` for the store; nothing else shown |
| Store notifications | NOT EXECUTED | List, Refresh, Load older, Mark as read (server read_at), neutral sentences |
| Read-only Orders | NOT EXECUTED | Bucket tabs, rows, Load more, detail; no action control anywhere |
| Store switching | NOT EXECUTED | Another store's numbers, notifications and Orders never appear under the current one |
| Buyer/Seller mode switching | NOT EXECUTED | Same session (no sign-in), Buyer screens show nothing of the store |
| Authentication and permission denial | NOT EXECUTED | Guest sent to Buyer Home; API stopped shows offline, not "not available"; a revoked store disappears |
| Account switching | NOT EXECUTED | Sign out, sign in as a Buyer-only Account: no Seller entry, no previous store data |
| Enlarged text (100%, 130%, 160%) and Dark | NOT EXECUTED | Home, chooser, Orders tabs (W18-13 rule), detail |
| TalkBack | NOT EXECUTED | Chooser rows read store, role and status; Orders rows read state, time, total; tabs selected; failures spoken |
| Android regression | NOT EXECUTED | WO-014..018 flows still pass with Seller mode present |
| iOS | NOT EXECUTED | No macOS hardware; EAS or cloud workflow needed |

## Executed

None recorded yet.
