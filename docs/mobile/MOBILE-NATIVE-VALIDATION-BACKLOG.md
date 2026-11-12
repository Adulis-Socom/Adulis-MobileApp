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

## From WO-021 (Seller Companion messaging)

WO-021 ran under a resource restriction (no emulator, Gradle, Maestro, Docker, PostgreSQL or local
API). Nothing below was run. Each check needs the API and a store whose owner or team member has
`seller.messages:*`, a Buyer conversation in the disposable data, and a first answer to W21-02:
does the running API accept `as=seller` from a MOBILE session at all?

| Item | Status | What to check |
|---|---|---|
| Seller conversation inbox | NOT EXECUTED -- RESOURCE DEFERRED | Messages on Seller Home; rows "Buyer conversation" + last activity, most recent first; Load more; Refresh; no Buyer id, preview or unread count |
| Seller message history | NOT EXECUTED -- RESOURCE DEFERRED | Opens with the store header; Load earlier; 30 s refresh while open only |
| Seller reply | NOT EXECUTED -- RESOURCE DEFERRED | Sending, then shown once accepted; text over 4,000 refused before sending |
| Buyer receives Seller reply | NOT EXECUTED -- RESOURCE DEFERRED | The Buyer's conversation shows it as "Seller" (owner) or "Seller team" after Refresh or within 30 s |
| Owner sender attribution | NOT EXECUTED -- RESOURCE DEFERRED | An OWNER's reply is "Store owner" on the Seller side |
| Team-member sender attribution | NOT EXECUTED -- RESOURCE DEFERRED | A SALES_SUPPORT reply is "Store team member"; record what an ADMIN's reply is (W21-11) |
| Seller A/B switching | NOT EXECUTED -- RESOURCE DEFERRED | Needs a second store; A's conversations and drafts never appear under B |
| Buyer/Seller switching | NOT EXECUTED -- RESOURCE DEFERRED | Same session; a same-Account conversation replied from Seller mode is the store's, not the Buyer's (W21 test 54) |
| Session expiry | NOT EXECUTED -- RESOURCE DEFERRED | An expired session in the inbox or a conversation signs out and leaves Seller mode |
| Permission refusal | NOT EXECUTED -- RESOURCE DEFERRED | An INVENTORY or ANALYST member sees "Messaging is not available for your role"; no sign-out |
| Offline behavior | NOT EXECUTED -- RESOURCE DEFERRED | API stopped: offline, never "not available"; a reply lost offline is "may already have been received" |
| Idempotent retries | NOT EXECUTED -- RESOURCE DEFERRED | Try sending again after a lost answer stores the reply once |
| Keyboard layout | NOT EXECUTED -- RESOURCE DEFERRED | Send stays above the keyboard (header offset, as WO-016) |
| Enlarged text (100%, 130%, 160%) | NOT EXECUTED -- RESOURCE DEFERRED | Inbox rows and the composer; history keeps its minimum height |
| Dark mode | NOT EXECUTED -- RESOURCE DEFERRED | Bubbles, automated-answer styling, alerts |
| TalkBack | NOT EXECUTED -- RESOURCE DEFERRED | Rows read "Buyer conversation, Last activity ..."; each bubble reads sender, text, anchor, time; send outcomes spoken |
| Android regression | NOT EXECUTED -- RESOURCE DEFERRED | WO-013..020 flows (Buyer messaging, Seller Home, Orders, notifications) |
| iOS verification | NOT EXECUTED -- RESOURCE DEFERRED | No macOS hardware; EAS or cloud workflow needed |

## From WO-022 (messaging reliability hardening)

WO-022 ran under the same resource restriction as WO-021. Nothing below was run. The gateway
and unreadable-response checks need a local proxy in front of the API that can fake those
answers; they are verified in Jest only.

| Item | Status | What to check |
|---|---|---|
| Buyer gateway failure retry | NOT EXECUTED -- RESOURCE DEFERRED | Needs a way to make the API path return a proxy 502/503/504 without the API problem (a local proxy); the message is "may already have been received", Try sending again stores it once |
| Buyer unreadable 201 response | NOT EXECUTED -- RESOURCE DEFERRED | Same harness: a 201 with a cut-off body is unknown, not "not sent"; the retry keeps the key |
| Buyer Product-context retry | NOT EXECUTED -- RESOURCE DEFERRED | An anchored message lost in transit retries with the same Product, text and key; Remove/Change Product locked |
| Buyer Product changes between attempts | NOT EXECUTED -- RESOURCE DEFERRED | Unpublish the Product before Try sending again: nothing sent, still unknown, Product shown as no longer available |
| Seller retry regression | NOT EXECUTED -- RESOURCE DEFERRED | A store reply lost in transit: unknown, retry stores once (WO-021 rows still owed too) |
| Buyer/Seller account switching | NOT EXECUTED -- RESOURCE DEFERRED | Sign out during an unconfirmed send; sign in as another Account; nothing of the first remains |
| Seller A/B isolation | NOT EXECUTED -- RESOURCE DEFERRED | Two stores: inbox header and composer name the open store; no draft or reply crosses |
| Seller messaging permission refusal | NOT EXECUTED -- RESOURCE DEFERRED | INVENTORY or ANALYST member: "not available for your role", no repeated requests (watch the API log) |
| Seller conversation UX | NOT EXECUTED -- RESOURCE DEFERRED | Inbox header, both times on each row, "Replies are sent as ...", spoken row labels |
| Long message rendering | NOT EXECUTED -- RESOURCE DEFERRED | A 3,000-character unbroken message wraps inside the bubble at 360 dp; no horizontal scroll |
| Keyboard accessibility | NOT EXECUTED -- RESOURCE DEFERRED | Composer, Try sending again and Edit the message instead reachable with the keyboard up; Send above the keyboard |
| Enlarged text (100%, 130%, 160%) | NOT EXECUTED -- RESOURCE DEFERRED | Inbox rows, store header, composer line, unknown-outcome text |
| Dark mode | NOT EXECUTED -- RESOURCE DEFERRED | Bubbles, automated-answer styling, alerts, store header |
| TalkBack | NOT EXECUTED -- RESOURCE DEFERRED | "Your message may already have been received" spoken; rows read title, last activity and start; store header read as a heading |
| Android regression | NOT EXECUTED -- RESOURCE DEFERRED | WO-013..021 messaging flows, Seller Home, Orders, notifications |
| iOS verification | NOT EXECUTED -- RESOURCE DEFERRED | No macOS hardware; EAS or cloud workflow needed |

## Executed

None recorded yet.
