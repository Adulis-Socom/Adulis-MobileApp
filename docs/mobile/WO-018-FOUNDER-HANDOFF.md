# WO-018 -- Founder handoff

**Buyer accessibility completion and native verification**, 12 November 2026.

## Status

**IMPLEMENTATION COMPLETE -- TALKBACK VALIDATION PENDING.** This is not an accessibility
certification. The parallel API test issue (ON-126) is reported separately in Gates.

| | |
|---|---|
| Branch | `mobile/wo-018-buyer-accessibility-completion` (pushed; not merged) |
| Started from | `mobile/wo-017-buyer-frontend-stabilization` at `ec8e1a11ce1822bc354293d3306145b4f3eed72d` |
| Final SHA | code and gates at `e00ff88`; the pushed head (this documentation commit) is in the final report |
| Records | [development report](WO-018-BUYER-ACCESSIBILITY-COMPLETION.md), [native and TalkBack](WO-018-NATIVE-ACCESSIBILITY-VALIDATION.md), [issues](WO-018-ISSUES-AND-BLOCKERS.md), [how to try it](WO-018-MANUAL-REVIEW-GUIDE.md) |

## What changed for a Buyer

- **Collections say what they are doing.** While a change is saving, the other choices are
  disabled and the one saving is "busy", for a screen reader too. Only one change runs at a time,
  and the result is spoken ("Added to Gift ideas.").
- **Every list has Load more**, beside the existing load-on-scroll. It uses the same request, so
  nothing is loaded twice. The button stays put while loading and after a failure ("Try again"),
  and how many items arrived is spoken.
- **Large text.** From 130% text, Shop, Search, Seller, Saved and Collection grids become one
  column and Product names are shown in full. Tab labels no longer break mid-word.
- **Focus is kept.** Pressing a Seller Profile tab leaves the screen reader on that tab, now
  selected. Each Delete Account step reads its first line by itself.

## What was verified, and how

- **Jest (in-memory server):** all of the above, including duplicate taps, failures, timeouts,
  session expiry and Account switching. Spoken text and focus moves are asserted as requests the
  app makes. That is not the same as hearing TalkBack.
- **Android emulator (real local API):** Seller tab selection at 100% and 160% Dark; the Shop's
  failed-next-page state with Try again in place at 130%; Add to collection and Remove at 130% Dark.
- **Found on the emulator and fixed:**
  - W18-12: one column did not switch on at Android's 130%, because the setting arrives as
    1.2999999.
  - W18-13: "Products" broke mid-word at 160%.

  Both are covered by Jest, but **not re-checked on the emulator**.
- **Not done:**
  - **TalkBack** (W18-11);
  - Delete Account focus, long names, 360 dp and For You on the emulator;
  - the A-F regression journeys on the emulator;
  - iOS.

## Why native testing stopped

An unrelated game held about 9.8 GB of memory throughout. With the emulator running, C: fell from
about 26 GB free to 9.78 GB, then to 5.78 GB. The emulator exited twice. The 10 GB gate blocked
further flows, so native work stopped. The page file was not changed and the game was not closed.

## Decisions for you

1. **TalkBack pass:** run section 3 of the manual review guide, or free the machine (close heavy
   programs, reboot) so a TalkBack session can run (W18-11, W18-02).
2. **Page file / heavy programs during native testing** (ON-20261111-161, W18-02, W18-08). This is
   unchanged from WO-015..017 and has now recurred, with C: at 5.78 GB.
3. **Unchanged and not decided here:** Account deletion, notification, chatbot and payment decisions;
   ON-129, -130, -132, -141, -146, -152, -154, -156; S-001, ON-162, ON-163.

## Gates

At `e00ff88`, on freshly rebuilt disposable databases (`G:\AdulisDevelopment\WO-018\logs\gates.out`):

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | PASS |
| API Jest, bounded (`--maxWorkers=2`) | 983/983 PASS |
| api-client test, `generate:check` | PASS (generated client unchanged) |
| Mobile typecheck, lint, test, build | PASS; Jest **427/427** (24 suites; 403 at the start) |
| Repo typecheck, lint, build | PASS |
| verify contract, appendix, docs, deps, mt-keys, error-locale | PASS |
| `db:check`, `db:determinism` | PASS |
| 14 ops gates, console-e2e, boot-smoke (PowerShell), orphan sweep | PASS |
| Full parallel `pnpm test` | **PASS in this run**: API 983/983, mobile 427/427. **ON-126 stays OPEN**: it failed in WO-017 and nothing was changed to fix it; one passing run is not proof |
| Expo Doctor 1.21.6 | **19/20**: Expo published patch releases after WO-017 (`expo` 58.0.25, `expo-sqlite` 58.0.17; the app has 58.0.24 and 58.0.16, unchanged by WO-018). Not upgraded here (W18-14) |
| Bundle subscription scan | 2 files, both identifier text in the Hermes bundle (event "subscription" names); no subscription, price, tier or billing copy |

OTP limits were not raised and no test was removed or weakened.

## Storage

Bytes free. C: is the system drive; G: is the SanDisk Extreme 55AE SSD (`G:\AdulisDevelopment`).

| Point | C: | G: |
|---|---|---|
| Start (audit) | 27,003,437,056 | 3,354,911,571,968 |
| After development (native preflight) | 26,964,357,120 | 3,354,896,891,904 |
| During native testing (low points, emulator running) | 13,175,558,144; 9,780,977,664; 5,779,984,384 | -- |
| After testing (before cleanup) | 25,690,492,928 | 3,353,220,218,880 |
| After cleanup | 25,681,055,744 | 3,353,514,868,736 |

- **Net growth:** C: 1,322,381,312 bytes less free (the system-managed page file grew from
  20,697 MB to 29,687 MB allocated; not changed by me). G: 1,396,703,232 bytes (WO-018 folder
  239,589,687 bytes: Maestro output, temp, logs; the rest shared caches).
- **Generated:** Maestro output and screenshots, logs, driver APKs, gate logs under
  `G:\AdulisDevelopment\WO-018`.
- **Removed:** 44 unused Maestro driver APKs (42 WO-018, 2 WO-017 leftovers), dry run first,
  277,668,072 bytes, all on G: (the audit's own total).
- **Recovered:** 277,668,072 bytes on G:.
- **Protected, untouched:** `G:\Android\` (the AVD configuration was not edited), `G:\w2`,
  `G:\w2x`, `G:\wo001a`, `G:\adulis-claude-scratch-archive`, `G:\w10a`, Docker volumes, other
  projects' containers and images, the page file.
- **Memory:** 0.36 GB free at the start, 0.16 GB at the worst point (Jest), 0.84 GB at the end;
  commit charge up to 42.7 GB with the emulator running.
- **Concerns:** W18-02 / W18-08. C: is not safe for native work while another heavy program runs.
- **Review data:** rebuilt after the gates (`prepare`, `long-names`); the API is stopped; the
  emulator is off.

## Recommended next Mobile work order

**WO-019 -- Native accessibility verification and TalkBack pass**, on a machine with no other heavy
program running (or after a reboot). In order:

1. Re-run the WO-018 harness: names at 100%, 130% and 160% and at 360 dp; paging retry; Delete
   Account steps.
2. Re-check W18-12 and W18-13 on the emulator.
3. Run the TalkBack script (T1-T12) on the emulator, and on a physical Android phone if available
   (ADU-MOB-02 S175: Ge'ez rendering on physical devices).
4. Run the A-F regression journeys.

Separately, outside the mobile workstream: the backend contract items ON-162 and ON-163, and the
ON-126 test isolation.
