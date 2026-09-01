# ADU-RUL-07 -- The Contract Rulings, and Three I Have Not Seen

**Version:** 1.0 - **Baseline date:** 31 August 2026
**Owner:** Founder / CEO
**Status:** Binding on D-153 and D-155. **D-154, D-156 and D-157 are NOT ruled -- see S4.**
**Related:** ADU-DB-01 v1.15 - ADU-API-01 v1.8 - ADU-CON-03 v1.1 (reissue owed)
**Encoding:** ASCII.

---

## 1. D-153 -- the data model wins, because it gave a reason

SC-03 and SC-04 specify a **buyer's first name**. Three deliberate absences stand against it:

|                           |                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `core.person`             | Holds a **keyed hash**. ADU-DB-01 S7.3's whole point is that no identity original is stored |
| `core.buyer_profile`      | An **anchor with no payload**, because S6.3 makes every attribute derived                   |
| `core.account.phone_e164` | Exists, and **S20.1 forbids showing it to a seller**                                        |

> **RULING -- the data model governs. ADU-CON-03 owes the correction, not the schema.**
>
> **A specification that asserts a field against a data model explaining why the field does not exist loses.** Three absences with reasoning attached, against an assertion with none.

**What the seller actually needs is to know which order they are looking at, and the order reference already does that.** SC-03 and SC-04 render the reference.

**If a buyer-visible name is genuinely wanted later**, it is a buyer-supplied **display name** on `buyer_profile` -- a new column, a product decision, and a DPIA question about a field sellers can see. **Not a rendering problem, and not something a screen specification can create by naming it.**

[!] **The** **`name`** **columns in migrations 0016 and 0017 do not reopen this.** `seller_company_detail.legal_name`, `identity_attestation.legal_name` and `person.legal_name` are all behind the verification boundary or on the company path. **None is a buyer's name reachable from a seller's order view.**

---

## 2. D-155 -- `allowed_actions` is a contract gap, and ADU-API-01 owes it

**No endpoint returns** **`allowed_actions`**, and `apps/console/CLAUDE.md` says the console renders them.

> **RULING -- this is the contract's to close, not the console's.** Recorded in ADU-API-01 v1.8 S15 as owed.

**Why it matters more than it reads.** T7 S7.3 rule 1 says the console computes no business state -- **it renders what the server resolved.** With nothing to render, every screen deciding what a seller may do is deciding it **from state it inferred**, which is the rule the console is built not to break. **It has held so far only because there was nothing to break it with.**

[!] **C-6 is where that stops being free.** Eight step-up actions, a payout cancel control that must be **absent** rather than disabled when no `PENDING` row exists (R21), and a closure blocked while deletion is not. **Each of those is the server's answer, and the console currently has no place to read it.**

**The shape when it lands:** per-object, named by permission code, and **the console never unions it with anything it worked out itself.** Until then, screens infer and **each inference is a register entry**, so the debt is visible rather than absorbed.

---

## 3. What ADU-CON-03 owes

**A reissue carrying D-153's correction**, and while it is open:

- **The nine readiness items, not ten** (D-21) -- R7(c) removed `ACTIVE_HOURS` and S9.4 was not updated with it.
- **SC-07's cap counter must name which limit binds** -- tier or level. **A NEW seller on a paid tier is capped at 10, and** ***"10 of unlimited"*** **is a bug report waiting to be filed.**
- **The chat anchor is on the message** (D-73), so any screen text describing a thread-level anchor is stale.

**I cannot write that reissue: ADU-CON-03 is not in the document set I hold.** Send it and it takes an afternoon.

---

## 4. D-154, D-156 and D-157 -- not ruled, and I will not guess

**I have the numbers and not the entries.** They were named as "the standing five contract rulings" and only **D-153 and D-155** have reached me with their text.

> **I am not ruling on three register entries I have not read.** Every ruling in this project has turned on a detail in the entry -- the composite key that had zero instances, the two NULLs that meant opposite things, the `roles[]` difference that was disclosure rather than a leak. **A ruling made from a title would be a guess wearing authority.**

**Send D-154, D-156 and D-157 and they are ruled in the next turn.**

[!] **Until then, do not treat this document as closing them.** Three of five is what it closes, and the register should say so rather than showing all five as answered.

---

## 5. What is now installed against what

| Document Version Carries  |           |                                                                                                           |
| ------------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| ADU-DB-01                 | **v1.15** | 0044-0046, the stamped challenge, transport-before-supersession, `is_live` withdrawn, D-190 corrected     |
| ADU-API-01                | **v1.8**  | `MARKET_UNAVAILABLE`, `SMS_NOT_SENT`, verify's three corrections, D-87's anchor, D-100 and D-155 recorded |
| ADU-AUTH-01               | v2.6      | Installed at T13 with its section split                                                                   |
| ADU-CON-03                | v1.1      | **Reissue owed -- S3**                                                                                    |

---

*Two rulings, one reissue named, and three entries I declined to rule because I have not read them. The declining is the part worth keeping: this project's rulings have each turned on a detail inside the entry, and a ruling made from a register title would be a guess wearing authority.*
