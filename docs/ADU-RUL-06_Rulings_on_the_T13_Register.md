# ADU-RUL-06 -- Seven Rulings on the T13 Register

**Version:** 1.0 - **Baseline date:** 31 August 2026
**Owner:** Founder / CEO
**Status:** Binding. Rules on D-190, D-192, D-193, D-196, D-202, D-203, D-204.1, and records D-206.
**Encoding:** ASCII.

---

## 1. D-190 -- 116 is right, and the sentence is mine

v1.14's Appendix B says **"Reproducing 114 names"** three lines under its own **"116 tables"**.

**You installed 116 and that is correct.** I updated the count and left the prose -- **in the sentence explaining that a number repeated in prose becomes a fourth copy of a fact that has already drifted three times.**

> **RULING -- 116 stands. The prose reads 116. And the sentence is right about itself.**

**v1.15 corrects it.** Do not transcribe 114.

---

## 2. D-203 and D-193 -- one change, not two

**Confirmed, and your reasoning is the ruling.** An anonymous path that resolves anything from the account creates the difference an attacker counts.

> **RULING --** **`core.otp_challenge`** **carries** **`market_id`****, stamped at creation from the DEVICE's market. Every parameter the challenge needs is stamped with it. Verification reads the challenge and never re-resolves a market.**

**That closes both entries with one column.**

- **D-203:** the attempt budget, the TTL and every observable quantity come from the stamped values, so **two markets configured differently produce no countable difference on an anonymous path.**
- **D-193:** per-market spend becomes attributable for free, because every challenge already names its market.

**And it removes an inconsistency nobody had noticed yet.** Without stamping, a challenge created under one market's parameters could be verified under another's -- **the device's market at request, the account's at verify.** Reading the challenge rather than the market makes that impossible rather than unlikely.

**The person is where their device bootstrapped.** That is the honest answer to *whose market governs*, and it is also the only one that does not leak.

---

## 3. D-196 -- `MARKET_UNAVAILABLE` yes; a transport failure code yes, and no invented channel

**Both go through an ADU-API-01 amendment**, which is the route your own correction identified -- the document permits a new code and forbids inventing one in a service.

**`MARKET_UNAVAILABLE`** is safe under S17: market availability may be disclosed **when it depends solely on public market configuration.** Every phone in that market gets the same answer.

[!] **And it must depend on nothing else.** If an unsupported market answers differently for a registered phone, that is a country oracle with an extra step.

**A transport-failure code, and only for the case that can honestly reach a response:**

> **Provider acceptance is synchronous and belongs in the response. Delivery is asynchronous and does not.**
>
> If transport definitively fails before the response -- rejection, failover exhausted -- the request **says so**, with a code identical for a registered and an unregistered phone. **If the provider accepted and delivery later failed, the request already returned and there is no channel.** The user learns on resend.

**Do not invent one.** A polled delivery status on an anonymous path is a new endpoint answering questions about a phone, and every such endpoint is an oracle until proven otherwise.

---

## 4. D-202 -- the placeholder is inert, and the number is set with the price

**Do not spend a decision on 2000/5000. Nothing is contracted, every provider is a fake, and no SMS costs anything today.**

> **RULING -- the ceiling is sized when the price is recorded, which S9.3 item 8 already requires before a market goes ACTIVE.** Keep the placeholder, mark it as one, and set it in the same act that records a real per-message price.

**And when it is set, express the reasoning as spend rather than as message count.** A count means nothing on its own; **a daily spend is a number a founder can decide** -- what am I willing to lose in a day before somebody wakes up -- and it survives a price change without a ruling.

---

## 5. D-204.1 -- S5.3 is about usable challenges, not rows

**You found a real contradiction and there is a third answer.**

Supersede at mint and a failed send leaves the user with **two dead codes** -- the old one destroyed, the new one undelivered, and a late-arriving first SMS now worthless. Supersede after transport and two challenges are live at once, which S5.3 forbids.

> **RULING -- a challenge that has not been transported is not live, and cannot be verified against. Supersession happens at transport acceptance.**
>
> There is **exactly one verifiable challenge at every instant**, which is what S5.3 protects. The new row exists un-transported and unusable; the old code stays valid until the new one is genuinely on its way.

**A code the user cannot have received is not a code they hold**, and S5.3's purpose is that only one code works -- not that only one row exists.

**This rides with D-198's fix.** A transport failure that leaves the user their previous code and tells them the resend failed is the correct pair of behaviours, and both come from the same repair.

---

## 6. D-192 -- make the limiter platform-scoped by design

**You are right that both obvious options are wrong.** Keep it and behind a proxy it is a platform-wide cap on **the whole client-configuration call** -- a first-time visitor gets 429 instead of market config, locales and the client floor. Remove it and anonymous device minting is unbounded at \~230 rows per second.

**There is no third subject.** The device cookie is exactly what the mint path does not yet have.

> **RULING -- the bootstrap mint limiter becomes PLATFORM-SCOPED deliberately, at a ceiling sized for the platform rather than for one caller.**
>
> **If it is going to collapse to one subject behind a proxy, it should collapse there on purpose.** It then bounds the write amplification honestly and stops lying about what it counts.

**Set the ceiling far above any plausible beta hour** -- a flood is orders of magnitude, not a multiple. **When S15.1's trusted-proxy work lands, it becomes per-IP at the intended ceiling**, and that is one configuration change rather than a redesign.

**Record it beside** **`platform_otp_budget`**: this is the second platform-scoped control, and the shape now has two members.

---

## 7. D-206 -- an agent that mutates the tree gets its own copy

**A review agent's mutate-and-restore silently reverted a BLOCKER fix, and it surfaced only because a test you had just written failed.** Without that test the fix would have been absent and the commit message would have claimed it.

> **RULING -- an agent that mutates the working tree runs against its own copy. Read-only lenses may share.**

**This is T11's rule from the other direction.** There: *a restore that is not proven in force un-tests the fix.* Here: **a restore that succeeds can un-write one.** Both are the same assumption -- that the tree is the state you last established -- and both were caught by something failing rather than by anyone checking.

[!] **Two lenses cannot mutate one tree, whatever the ordering discipline.** A pass that plants and restores is a pass that writes, and **the only safe number of writers is one.**

---

## 8. Two classes worth carrying

**D-198 is D-69's mirror.** D-69: a handler that throws writes no idempotency record, so a replay **re-executes** -- which leaked an oracle. D-198: a handler that commits and then fails **outside** the transaction writes one, so a replay **replays a success that never happened.** **Same table, opposite failure**, and the second is worse because the client was told 202.

> **The rule that covers both: the idempotency record must be written by the same boundary that decides the request succeeded.** Anything that can fail after the record commits must either be inside the transaction or must not be part of the promise the record replays.

**D-203 is enumeration through a quantity.** S17 forbids a **response** that reveals account existence. **The number of responses is not a response** -- and any per-market parameter that shapes an observable count becomes an oracle the moment two markets differ.

**Neither needs a misconfiguration. Both need only a second market.**

---

*Seven rulings. Two of them collapse into one column, one of them was a sentence of mine that was right about itself and wrong in its own number, and two of them are old classes arriving from the opposite direction -- an idempotency record that replays instead of leaking, and a restore that un-writes instead of failing to hold.*
