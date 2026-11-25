# GOV-06 -- Typed fixture ports and the release boundary (clean rebuild)

Status: binding specification for every replacement client (Console, Mobile, Storefront, Operator). Built in
ARC-BE-05 (shared harness) and in each surface's first frontend order (SC-FE-01, MOB-FE-01, SF-FE-01,
OP-FE-01). It reuses the boundary designed in Batch 01 (failure modes F1-F10) and the pattern proven by the
legacy Console (PR #181, CI gate `console-fixture-e2e`); the clean clients re-implement it against the
replacement contract, they do not copy the legacy module.

## 1. The rule
- **Every production mutation goes through the generated owner API client** (from the replacement OpenAPI).
  There is no other write path in a release build.
- **A fixture is a development-only port**, selected at build time, never at run time, and it never calls the
  network. A missing live contract is a GAP (RBL-04 register), not a licence to invent one; a fixture may stand
  in for it only in development and only with a typed shape that names the GAP.
- **No live fallback.** Fixture mode never reaches the live API; live mode never reaches a fixture.
- **No simulated commerce in release.** No fixture transport, demo data, simulated payment, paid Order, stock
  hold, handoff credential, Review Grant, Claim or trust progress ships in a release build or reaches a real
  record.

## 2. The port (shape every client implements)
```
interface Transport {                       // one choke point per client
  json<T>(op: OperationId, call: Call): Promise<T>;   // OperationId comes from the generated client
  blob(op: OperationId, call: Call): Promise<Blob>;
}
liveTransport    = generated client (production + development)
fixtureTransport = typed data, read-only by default, DEVELOPMENT ONLY
```
- Selection: `FIXTURES_ON = <build is development> && <explicit opt-in flag>`; the fixture module is reached
  only through a dynamic import guarded by that constant, so a release build folds it away.
- Data: versioned (`FIXTURE_VERSION`), typed against generated types where they exist (a compile-time
  conformance check where they do not), ids carry a reserved prefix (`fx_`), and every screen in fixture mode
  shows a persistent "Demonstration data" banner.
- Writes: none by default. A fixture write is added only by a named work order with its own test, and never
  for payment, payout, handoff, moderation, report, evidence, Claim or trust paths (deny-list as a backstop).
- Live transport refuses a reserved fixture id before sending (F6).

## 3. Isolated demo (Option C and gated simulations)
SC-FE-07, MOB-FE-06, MOB-FE-07, MOB-FE-08 (simulations), MOB-FE-11 (Courier demo) and OP-FE-05/06 (gated
cases) may draw future states (paid Order, handoff, delivery, Claim) ONLY as fixtures, behind a separate
internal demo entry that is outside ordinary navigation and absent from release builds. They use the
canonical November models (ADU-ORDER-01, HND-01, CLAIM-01), never the retired Reservation. No backend route,
table, event or analytics authority is created to simulate them (MOB-BE-03).

## 4. Release-negative tests (required gates; the shared harness is ARC-BE-05)
| Test | Proves |
|---|---|
| RN-1 release scan | a release build made WITH the fixture flag set contains none of the fixture markers (module marker, an `fx_` id, the banner sentence, the refusal code); a positive control proves a development build contains all of them |
| RN-2 no network in fixture mode | in fixture mode the page makes no request to any API origin, and every attempted call is recorded and checked against the prohibited-path list |
| RN-3 fail closed | unserved and prohibited operations refuse with a fixture-blocked code; nothing reaches fetch |
| RN-4 tenant isolation | two fixture Sellers with disjoint data; switching, Back/Forward, direct links and late responses never show the other Seller (carried from #181 and #188) |
| RN-5 no fixture id to live | the live transport refuses a reserved-prefix id |
| RN-6 no simulated commerce | a release build has no demo entry, no simulated payment/Order/handoff/Claim route or string |
| RN-7 real-API gates run without fixtures | the real-API suite builds in release mode and asserts the build id |

## 5. Failure modes carried (Batch 01 F1-F10)
F1 release inclusion (RN-1), F2 silent live fallback (RN-2/RN-3), F3 fake PAID treated as real (no paid
state outside the isolated demo; RN-6), F4 legacy financial controls reachable (absence, ARC-BE-06), F5 blob
bypass (same transport), F6 fixture id to live (RN-5), F7 cross-Seller leakage (RN-4), F8 fixture mistaken for
the contract (generated types only; RBL-04 GAP register), F9 fixture writes to moderation/Story state (no
default writes; deny-list), F10 real-API gate passing on fake data (RN-7).
