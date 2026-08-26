# ADU-CON-02-A1 — Capacity Model and Failure Analysis

**Version:** 1.0 · **Baseline date:** 26 August 2026
**Owner:** Founder / CEO
**Status:** Test report and binding annex to ADU-CON-02 v2.0. Carries two rulings and one ruling request.
**Method:** Analytical capacity model. The system is not yet built, so this is **not an empirical load test** — it is the workload that ADU-PRD-01/DB-01/API-01's own mechanics generate, priced against stated capacity assumptions and run at eight scales. Doctrine 12 applies in both directions: these numbers are the instrument that says *what to measure*; ADU-CON-05's load tests replace every assumption with a measurement.

---

## 1. The question and the answer

**"At what number of users does this system fail?"** — answered as a ladder, because systems do not fail once; they fail in a sequence, and each rung has a different kind of fix.

The model is keyed to **active sellers**, because sellers generate the origin load. Anonymous buyer browsing rides Cloudflare's 60-second edge cache and barely touches the system; as a rough translation, active buyers ≈ 20–30× sellers, so 25k sellers ≈ half a million monthly buyers.

| Rung | ~Sellers | What fails | Kind of failure | Fix | Cost of fix |
|---|---|---|---|---|---|
| **1** | **~80** | **SMS OTP spend exceeds the entire $50/mo infrastructure target.** $648/mo at 1,000 sellers; $6.5k/mo at 10k | **Economic** | Ruling request **RR-17** (§4.2) | A policy change |
| **2** | ~1,500 | Same line crosses $1k/mo, and the 3-OTP/hour phone limit starts locking out legitimate sellers mid-workday | Economic + UX | Same | — |
| **3** | *build time* | `seller_public_stats` built as a literal `MATERIALIZED VIEW`: refreshes are O(entire history) per debounce — 2s constant burn at 5k sellers, 9s at 10k, untenable ~30k | **Specification ambiguity** — the word "materialized" in ADU-DB-01 §8.3 invites the agent to build the wrong thing | Ruling **R16** (§4.1) | Zero if caught now |
| **4** | ~10,000 | Analytics growth ≈ 2 GB/day: disk spend and autovacuum pressure on the OLTP box | Operational | Ruling **R19** (§4.4) | A retention job |
| **5** | ~17–24k | **PG small (1 vCPU) saturates** — hot at ~17k, over at ~24k | Capacity | Upgrade tier | A dashboard click |
| **6** | ~30k | Evidence viewing buffers ~5 MB × concurrent viewers; starter API instances run out of RAM | Capacity | Ruling **R18** (§4.3) | Code pattern |
| **7** | ~68–97k | **PG medium (4 vCPU) saturates** | Capacity | PG large **+ move `analytics` to its own Postgres** (still "Postgres as the datastore"; it is the documented relief valve — the schema has no FKs into it by design) | Migration + config |
| **8** | ~140k | Direct database connections exhausted as API instances multiply | Capacity | PgBouncer transaction mode — §6.1 of ADU-CON-02 was written to be compatible with it on purpose | One service |
| **9** | **~200–300k** | **The single Postgres primary's write ceiling.** Vertical scaling and the analytics split are spent; the 08:00 notification burst passes 15 minutes around the same point | **Architectural** | Sharding / regional split — genuine redesign territory | The next architecture document |

**So, plainly:**
- **Economically, the design as specified fails at roughly 80 sellers** — before the beta cohort is even full — on SMS cost. This is the real finding of the test and it is fixable by policy (§4.2).
- **Technically it first fails at ~17–25k sellers** on the smallest database, fixable by a plan upgrade.
- **Architecturally it fails at ~200–300k sellers** — the single-writer Postgres ceiling. That is the honest lifespan of this architecture, and it is far beyond every gate in ADU-PROJ-01 §11. Reaching it is the good problem.
- **One failure is at build time, not at any scale** — rung 3 — and it costs nothing today and a rewrite later.

---

## 2. Assumptions

Every input, stated so it can be attacked and replaced. Bands are the honesty margin; conclusions below survive ±40% on all of them.

**Workload, per active seller per day:** 200 anonymous storefront views (15% reach origin past the edge cache) · 350 authenticated buyer-app requests (browsing, the cart's re-check-on-view, the order card's re-read-on-view) · 2 orders · 20 chat messages · 5 stock updates · 60 console actions · **180 console polling requests** (inbox/notifications every 30s across 1.5 open hours — the design has no push channel to the browser) · 50 Companion requests. **≈ 692 origin requests/seller/day; peak hour carries 10%.** 12% of origin requests are state-changing.

**Cost per request, in database statements** — this is where the design's own invariants are charged honestly:

| Share of all statements | What it is |
|---|---|
| **47%** | `BEGIN` + `set_config` + `COMMIT` — the RLS transaction wrapper (§6.1) |
| **16%** | The session-row read — the immediate-revocation invariant |
| 16% | The actual query or function call |
| 14% | The analytics event insert (×1.5 for the plpgsql validation trigger) |
| 7% | Idempotency, rate bucket, notification enqueue |

≈ 6.4 statements per origin request. **Nearly two-thirds of database work is the price of two invariants, not of features.** Both were bought deliberately (ADU-DB-01 §6.6, ADU-CON-02 §6.1); the model simply shows the receipt. A later optimisation — sending `BEGIN; SELECT set_config(...)` as one round trip — is noted and *not* done now.

**Capacity (sustained statements/sec at 70% target):** PG small 3k · medium 12k · large 40k. Node instance ≈ 300 RPS. Direct-connection ceiling ≈ 100. FCM dispatch ≈ 200/s per worker. SMS $0.012 (local band $0.008–0.02). Evidence cap 5 MB.

---

## 3. The model's output

| Sellers | Peak RPS | DB stmt/s | API inst. | SMS/day | **SMS $/mo** | 08:00 burst | Analytics GB/day |
|---|---|---|---|---|---|---|---|
| 100 | 1.9 | 12 | 1 | 180 | **$65** | 0 | 0.02 |
| 1,000 | 19 | 123 | 1 | 1.8k | **$648** | 0.1 min | 0.2 |
| 5,000 | 97 | 616 | 1 | 9k | **$3.2k** | 0.3 min | 1.0 |
| 10,000 | 193 | 1.2k | 1 | 18k | **$6.5k** | 0.7 min | 2.1 |
| 25,000 | 483 | 3.1k | 2 | 45k | $16k | 1.7 min | 5.2 |
| 50,000 | 965 | 6.2k | 4 | 90k | $32k | 3.3 min | 10.4 |
| 100,000 | 1.9k | 12.3k | 7 | 180k | $65k | 6.7 min | 20.9 |
| 250,000 | 4.8k | 30.8k | 17 | 450k | $162k | 16.7 min | 52.1 |

Headroom against tiers: small **fails at 25k** · medium fails at 100k · large runs hot at 250k. Everything scales linearly because the workload is per-seller and the buyers' bulk is on the edge — which is itself a result: **the edge-cached anonymous storefront is why a 250k-seller platform generates only ~5k origin RPS.** The A4 anti-enumeration/caching decision is carrying enormous load silently.

---

## 4. Rulings and the ruling request

### 4.1 R16 — `seller_public_stats` is a trigger-maintained table. It is never a `MATERIALIZED VIEW`.

ADU-DB-01 §8.3 says the stats are *"materialized and refreshed on relevant writes."* Built literally as Postgres's `CREATE MATERIALIZED VIEW`, every refresh re-aggregates **every seller's entire history** to update one seller's row — O(total) work per event, plus `REFRESH CONCURRENTLY` churn and locks. The sensitivity check shows even optimistic constants burn seconds per refresh from 5k sellers with months of history. The failure is the shape, not the constant.

> **RULING R16 — `core.seller_public_stats` is a plain table with one row per seller, updated in O(1) by the same triggers that already fire on `handoff_scan`, `review`, `claim` and level events.** ADU-DB-01 v1.7 rewords §8.3, and **Appendix C gains check 15: `grep -c "MATERIALIZED VIEW" migrations/` = 0.** The read stays exactly as cheap as the design wanted; the write stops being a time bomb an agent plants on day one.

### 4.2 RR-17 — ruling request: remembered-device console sessions (founder decision required)

**The finding.** ADU-AUTH-01 §8.1 gives the console a **30-minute idle timeout** with phone OTP as the only sign-in factor. Therefore every console return after a >30-minute gap is one SMS. A seller who checks morning, midday and evening costs 3 SMS/day. Even the floor — one visit a day — is **$360/month at 1,000 sellers**, seven times the entire infrastructure budget, rising linearly forever. At 10k sellers the specified design spends **~$6,500/month on sign-in messages**, and the 3-OTP/hour phone rate limit (§22) begins locking out honest sellers who mistype once.

This is not an implementation bug; the specification, followed exactly, produces it. It needs a ruling because the fix touches a binding security document.

**Recommendation — adopt:** a **"remember this device"** option at console sign-in. On a remembered device (long-lived `__Host-` device cookie): absolute session **7 days**, idle **8 hours**. On any other device: today's 12h/30min stands. Both values live in `timing_config`, which already owns session lifetimes per market.

**The security trade, stated honestly:** a longer session is a longer window for a stolen cookie. Why the trade is sound *in this architecture specifically*: the cookie is `HttpOnly` + `__Host-` (theft requires device compromise, not XSS); **every action that moves money or membership already demands a fresh step-up OTP regardless of session age** — that is the real control, untouched; new-device sign-ins still notify unsuppressibly; revocation is still immediate per request; and the payout activation delay and order snapshots still make even a compromised session largely harmless to money in flight. The 30-minute idle was defending against a borrowed-laptop scenario; the remembered-device flag is precisely the seller asserting this is not that laptop.

**Effect:** ~1.5 → ~0.2–0.3 OTP/seller/day. At 10k sellers: **$6.5k → ~$1.2k/month.** Residual SMS is buyer signups and step-ups — spend that tracks *transactions*, which is the correct shape for a cost. Passkeys/WebAuthn are the post-MVP path to near-zero and are noted for ADU-AUTH-01's roadmap, not built now.

**If declined:** the SMS line becomes a per-seller operating cost that pricing must absorb (~$0.65/seller/month at current behaviour assumptions) — a business decision, and this annex's job is only to make it a *decided* one.

### 4.3 R18 — evidence decryption is streamed, never buffered

Whole-file AES-GCM requires holding the full object in memory to verify the tag; 5 MB × concurrent viewers exhausts a 512 MB instance around rung 6.

> **RULING R18 — payment evidence is encrypted as a sequence of ~64 KB AEAD frames (chunked AES-256-GCM, per-frame nonce from a counter), so the API decrypts and streams frame-by-frame with constant memory.** The 5 MB `EVIDENCE_TOO_LARGE` cap stands. This is an encoding detail of the R15 boundary and changes no interface.

### 4.4 R19 — analytics partitions retire to R2

> **RULING R19 — `analytics.event` monthly partitions older than 6 months are detached, exported to R2 as Parquet, and dropped.** Live data stays in Postgres; cold data becomes files. Needed from ~10k sellers; built as an ordinary graphile-worker job when tier 8 lands. This is also the pre-built escape hatch for rung 7: `analytics` has no foreign keys into it *by design*, so moving it to its own Postgres later is a connection string, not a migration.

### 4.5 Recorded, not ruled

- **Console polling is ~26% of all origin traffic.** The no-websocket decision is right for MVP; a single SSE endpoint for inbox/notifications is the first optimisation worth making after launch, and it deletes a quarter of the load. Recorded for the roadmap.
- **A flash drop on one variant tops out at ~125 orders/s** — the row-lock serialisation on the hot `stock_count` row. A 1,000-unit drop sells out in ≥8 seconds with buyers briefly queueing and **nobody oversold**, which is the constraint doing exactly its job. Bounded, acceptable, worth knowing before the first viral seller.
- **Cloudflare's free plan carries one rate-limiting rule; §10.1's table needs several.** The Pro plan (~$25/mo) joins the cost model at launch. Small, but it belongs in a decided budget, not a surprise.
- **The 08:00 burst** is minutes, not seconds, from ~50k sellers; the dispatcher parallelises trivially when that day comes.

---

## 5. What deliberately does *not* fail — the design earning its keep

Worth recording, because these are the places a reviewer will expect failure and should understand why there is none: **buyer browsing** never reaches the origin at scale (edge cache + payload budget); **overselling is impossible at any concurrency** — `CHECK (stock_count >= 0)` turns a race into a clean transaction failure; **expiry and every sweep** run on partial indexes sized to the live set, not the table; **the ledger's** hourly zero-assert is one indexed aggregate; **idempotency and rate-limit churn** are bounded by their hourly purges; and **a stolen console session cannot reroute money** regardless of load, because that guarantee lives in step-up + activation delay + order snapshots, none of which have a throughput term.

---

## 6. What ADU-CON-05 must measure — replacing this model

Six load tests, each aimed at an assumption above, run against staging before beta: (1) order creation on one hot variant at 50/100/200 concurrent buyers — measures the real txn hold and the queueing curve; (2) the expiry sweep against 1M orders with 10k live — partial-index behaviour; (3) the stats-update trigger path under 100 scans/s — proves R16's O(1); (4) the 08:00 dispatch at 10k queued notifications; (5) evidence streaming at 100 concurrent viewers on one instance — proves R18's flat memory; (6) **the pooled-connection settings-leak test under load** — two interleaved identities on one pool must never cross, which is the invariant everything else stands on.

## 7. Document impact

ADU-DB-01 v1.7 gains R16 (+ Appendix C check 15), R18's encoding note, R19's job · ADU-AUTH-01 → v2.1 **pending RR-17's ruling** · ADU-CON-02 §21 adds Cloudflare Pro and the post-ruling SMS line · ADU-CON-05's test plan seeds from §6.

---

*Test report. The ladder's summary: the specification fails economically at ~80 sellers on SMS, technically at ~17–25k on the smallest database, and architecturally at ~200–300k on the single Postgres primary — with one build-time trap (the materialized view) that costs nothing today and a rewrite later. Two rulings taken, one requested. Every number here is an assumption wearing its band; ADU-CON-05 replaces them with measurements.*
