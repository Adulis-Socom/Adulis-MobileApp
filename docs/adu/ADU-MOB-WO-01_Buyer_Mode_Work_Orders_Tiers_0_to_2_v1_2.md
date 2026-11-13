# ADU-MOB-WO-01 -- Buyer Mode Work Orders, Tiers 0 to 2

**Version:** 1.2  -  **Baseline date:** 7 September 2026
**Prepared and executed by:** Founder / CEO -- sole engineer, with the coding agent (ADU-REPO-01 v1.3 S3)
**Supersedes:** ADU-MOB-WO-01 v1.1
**Status:** Working instrument. **Not binding.** ADU-MOB-01 v1.2 governs; where this and that document disagree, that one wins and this one is corrected.
**Source:** ADU-MOB-01 **v1.2** S18's tier table, S17.5's loop, S18.1's gates  -  ADU-MOB-02 **v1.0**  -  ADU-MOB-03 **v1.0**  -  ADU-MOB-05 **v1.0**  -  ADU-MOB-06 **v1.0**  -  **Adulis Mobile AI-Assisted Engineering Manual, 7 September 2026**  -  ADU-MOB-AMD-02 v1.0
**Continues in:** ADU-MOB-WO-02 (tiers 3-5), ADU-MOB-WO-03 (tiers 6-8)
**Encoding:** ASCII.

---

## 0. What changed in v1.2

**The Engineering Manual is adopted, and WO-0 splits in two because of what it says.**

| # | Change | Where |
|---|---|---|
| **A** | **WO-0 becomes WO-0a and WO-0b.** The manual S17.6 says *"do not allow the coding agent to autonomously download or upgrade mutable global tooling"*, and S25 bounds agent capability by environment. **Installing plugins, registering MCP servers and adding global npm tooling is operator setup, not agent work** -- it needs your authentication, it changes your machine, and an agent that installs its own capabilities is the autonomy S40 warns against | WO-0a |
| **B** | **WO-0b gains the agent-authored configuration**: the two project skills, the `product-invariant-reviewer` subagent, and the deterministic hooks. **These are markdown and shell in the repository -- they are agent work**, unlike a global install | WO-0b |
| **C** | **The Engineering Manual joins the read-first list** for every slice in this document | WO-0b, WO-1, WO-2 |
| **D** | **P8 is new**: WO-0a complete before any agent session | S1.2 |
| **E** | **MB-01 ships as Life 1 only** when tier 3 arrives -- ADU-MOB-AMD-02 S H. **Not a change to these three slices**, recorded here so it is not discovered in WO-02 | S3 |
| **F** | Governing version updated to ADU-MOB-01 **v1.2** | header |

> **The manual and this document agree on the important thing and it is worth stating once.** The manual S23: *"do not create another generic Definition of Done that competes with Adulis's release gates."* **This document is those gates.** The manual supplies the toolchain; the work orders supply the requirements; **neither restates the other.**

## 0.1 What changed in v1.1

**v1.0 was written a week before the rest of the series existed. Six documents have landed since, and three of them change these three slices.**

| # | Change | Where |
|---|---|---|
| **A** | **P3 is closed. The age declaration is built** -- ADU-AUTH-01 v2.8 S18 carries the columns, the verify field and `AGE_DECLARATION_REQUIRED`. **WO-2 builds the screen** | S0.3, WO-2 |
| **B** | **Nine grep gates became fourteen.** Gates 10-11 from ADU-MOB-01 v1.1, gates 12-14 from ADU-MOB-03 S8 | WO-0 |
| **C** | **The offline withdrawal.** SQLite holds **one row**; `src/store/`, not `src/offline/`; the 401 rule keeps the **order idempotency key**, not a scan queue | WO-0, WO-2 |
| **D** | **ADU-REPO-01 v1.3 exists.** P2 is a check against a real document, and CI is path-filtered by `pnpm --filter "...[origin/main]"` rather than hand-enumerated | S0.2, WO-0 |
| **E** | **`packages/tokens` is authored** by ADU-MOB-03 and has to be created in WO-0 -- it has been imported by the console for months and never written down | WO-0 |
| **F** | **The privacy manifest is a new WO-0 item** with an upload-blocking failure mode (ADU-MOB-05 F3) | S0.2 P6, WO-0 |
| **G** | **N1 is a new blocker on WO-2's shape** -- ADU-AUTH-01 v2.8 and ADU-API-01 v1.11 disagree on the verify body | S0.2 P7 |
| **H** | **Screens have specifications now.** MB-04 and MB-05 are in ADU-MOB-02; the components are in ADU-MOB-03. v1.0 said tiers 0-2 need no screen specification, and that was true then | WO-1, WO-2 |
| **I** | Ownership corrected -- there is no COO/CTO. **Sixteen `db:check` passes, and OTPs go to `.dev-sms.log`** | S0.1 |

---

## 1. How these are run

One work order is one slice. The agent receives **the sections listed, not the intent** -- *"the agent receives documents, not vibes."* It builds inside the slice, **stops at the boundary, and lists what it did not do.** Verification is a command. Then the review against the checklist, then the PR.

> **Start the session from `apps/mobile`, not the repository root.** From the root the agent loads only the root instruction file -- so it has none of this workstream's rules and all of the backend's (ADU-REPO-01, and ADU-MOB-00 S3.2).

**Review is CI plus the agent's adversarial pass against its own work** (ADU-MOB-01 S17.5). Its weakness is named: a pass on your own work is a pass by the person who made the assumptions. **Where a change touches money, identity or a boundary, the second pass is not optional** -- and tiers 1 and 2 are read line by line by hand.

### 1.1 The gates have two halves, and deferring is not skipping

**Each gate below is split into a CI/emulator half and a device half.** The CI half runs today, on an emulator, against the **local** API. The device half goes into `apps/mobile/DEFERRED-GATES.md`, by name, with its tier.

> **Tier 3 does not start until the device half of tiers 0 to 2 has been run.** A deferred gate that nobody wrote down is a skipped gate, and the difference between the two is a file.

**The local environment** (ADU-MOB-00 S3.1): `docker compose up -d`, `pnpm db:migrate && pnpm db:check` -- **sixteen checks** -- `pnpm db:seed`, `pnpm --filter api dev` on `:3000`. **OTPs are written to a gitignored `.dev-sms.log`, never printed to the terminal**, and on a shared or multi-user machine that file must not be used at all.

### 1.2 Prerequisites

| # | Prerequisite | Blocks | State |
|---|---|---|---|
| **P1** | **ADU-API-01's two-version `X-Adulis-Client`** and a parser that tolerates it | Only the header's second segment (WO-1 S3.6) | **Drafted twice, applied never.** The contract is at v1.11 without it |
| **P2** | **ADU-REPO-01 v1.3 read** against ADU-MOB-01 S17.1's slot, the four dependency rules and the three seams | WO-0's first commit | **Do this before the directory is created** |
| **P3** | ~~The age declaration has no write path~~ | -- | **CLOSED.** ADU-AUTH-01 v2.8 S18. WO-2 builds the screen |
| **P4** | Reference devices ordered (ADU-MOB-01 Q7) | The device half of every gate | Not started |
| **P5** | **The domain** (Q1) | Tier 3 -- **and now also Apple organization enrolment**, which requires a work email on the domain and a public website at it (ADU-MOB-05 S1.3) | Not started. **It moved up the critical path** |
| **P6** | **The iOS privacy manifest** -- `expo.ios.privacyManifests`, plus a throwaway upload to confirm it | **Nothing in code. It blocks the first upload**, which is the natural discovery point | **New. Belongs in WO-0** |
| **P7** | **N1 -- the verify body** | **WO-2's shape.** `challenge_id` versus `phone` decides whether the screen keeps state between two steps | **Open. Build against ADU-AUTH-01 v2.8** |
| **P8** | **WO-0a complete** -- the toolchain installed, authenticated and verified by you | **Every agent session.** WO-0b's first gate is that the environment exists | **New in v1.2** |

### 1.3 P7, and why it is not a reason to wait

**ADU-AUTH-01 v2.8 S5.2 says verify takes `{ challenge_id, code, device_id, age_declared_over_18 }`. ADU-API-01 v1.11 S5 says `{ phone, code, audience, device_id }`.** Three differences, and one of them -- `audience` -- is rejected outright by D-180.

> **Build against ADU-AUTH-01 v2.8.** It owns authentication, D-180 was written into it, and API v1.11's own change table says S12.2 was corrected while S5's code block was not -- *"a surgical edit preserved exactly the part nobody re-read."*
>
> **Isolate the difference in one module** so the correction is a one-file change: the OTP client wraps the request and verify calls, the screen never assembles a body, and **`challenge_id` is held in the sign-in flow's transient state** (ADU-MOB-01 S3.4's Zustand store) rather than threaded through props.

---

## WO-0a -- Environment setup

**Executed by you, at a terminal, before any agent session. This is not a work order and no agent performs it.**

> **Why it is split out.** The Engineering Manual S17.6, S21 and S25 all say the same thing from different angles: **an agent must not install its own capabilities.** These steps need your Expo and GitHub authentication, they change your machine outside the repository, and a coding agent that can add its own tools and MCP servers has crossed the boundary the whole manual exists to hold.
>
> **It is also a one-time cost.** Once done, every later session inherits it.

### 0a.1 Install

**Claude Code plugins** -- from the official marketplace:

```bash
claude plugin install expo@claude-plugins-official
claude plugin install typescript-lsp@claude-plugins-official
claude plugin install context7@claude-plugins-official
claude plugin install github@claude-plugins-official
claude plugin install security-guidance@claude-plugins-official
claude plugin install pr-review-toolkit@claude-plugins-official
```

**Then authenticate Expo inside a Claude session:**

```text
/mcp
```

> **The Expo plugin registers the Expo MCP server itself.** If you install the plugin you do **not** also run `claude mcp add`. **If you ever install the MCP without the plugin**, the documented form is `claude mcp add --transport http expo https://mcp.expo.dev/mcp`. **Do not do both** -- a duplicate registration is a duplicate tool list.

**Global tooling:**

```bash
npm install -g typescript-language-server typescript
npm install -g agent-device@latest
```

**Maestro** -- install the CLI per its own instructions, then:

```bash
claude mcp add maestro -- maestro mcp
```

### 0a.2 Verify before you rely on any of it

| # | Check | Why |
|---|---|---|
| 1 | `node -v` is **22.12 or higher** | agent-device requires it. `.nvmrc` says 22; the minor version is not guaranteed |
| 2 | **agent-device drives an Android emulator from Windows** | Its documentation does not explicitly confirm Windows. **Prove it once, now**, rather than discovering it in tier 6 |
| 3 | `/mcp` shows Expo authenticated, and **exactly one** Expo registration | 0a.1 |
| 4 | `/context` from `apps/mobile` loads the root file and this workstream's, **and no sibling workstream's** | ADU-REPO-01 S8 |
| 5 | `/permissions` shows the deny rules from `apps/mobile/.claude/settings.json` resolved | The boundary is a guarantee or it is a habit |

> **Expo's local capabilities -- screenshots, tapping views, finding by `testID` -- need a dev server running the `expo-mcp` package**, not just the authenticated remote server. **They overlap agent-device substantially.** Use whichever proves reliable on Windows first and do not build a workflow that needs both.

### 0a.3 Not installed, and each is a decision rather than an omission

**Figma** -- deferred until ADU-MOB-04 is actually run (manual S18). **PostHog and Sentry** -- the plugins may be added later for reading data; **the mobile SDKs are forbidden by B2** and by the manual S19. **Firebase, Supabase, Prisma** -- ADU-CON-02 S3 rejected Firebase and Supabase by name. **Playwright** -- not for the native app. **Filesystem, sequential-thinking and memory MCPs** -- manual S40.

### 0a.4 The credential rule, applied now rather than later

> [!] **The Expo session you just authenticated can publish over-the-air updates to every installed copy of the app** (ADU-MOB-06 S3.1, manual S26).
>
> **For the whole of tiers 0 to 2 this is theoretical -- there are no installs.** It stops being theoretical the day the first build reaches a device. **The rule from that day: nothing publishes from a developer machine** (ADU-MOB-07 O3), and production publication follows the release process rather than a session.

---

## WO-0b -- Toolchain, tokens, agent configuration and shell

**Purpose:** an installable app that starts, renders one screen in both scripts, and has every guard rail -- mechanical and agentic -- in place before the first feature is written.

### 0b.1 Read first

ADU-MOB-01 v1.2 **S3.1, S3.2, S3.7, S12, S17.1, S17.2, S17.4, S17.5, S18, S18.1**  -  **ADU-REPO-01 v1.3 in full**  -  **ADU-MOB-03 v1.0 S2 and S8**  -  ADU-MOB-05 **S4.3**  -  **the Adulis Mobile AI-Assisted Engineering Manual S11, S12, S13, S14, S22, S23**  -  ADU-CON-02 **S13, S16**  -  ADU-PRD-01 **S23.1**.

### 0b.2 Build

**The workspace**

- The `apps/mobile` workspace in the slot ADU-REPO-01 v1.3 gives it, with ADU-MOB-01 S17.2's tree created empty where it is not yet populated. **`src/store/`, not `src/offline/`.**
- **`packages/tokens`, authored from ADU-MOB-03 S2**: `color.ts`, `typography.ts`, `space.ts`, `radius.ts`, `motion.ts`, `elevation.ts`. **Values only. It imports nothing.** `brand.base` takes the placeholder until it is ruled; the other three brand tokens derive from it.
- Expo SDK and React Native **pinned exact**; `strict: true` extending `packages/config`; `.nvmrc` inherited.
- `app.config.ts` with the config plugins for secure store, camera, notifications, SQLite and updates. **No App Links or Universal Links configuration** -- there is no domain, and a half-configured association is worse than none.
- **`expo.ios.privacyManifests` populated**, with third-party packages inspected for their own `PrivacyInfo.xcprivacy`.
- `eas.json` with the three profiles of ADU-MOB-01 S19.1.
- Inter and Noto Sans Ethiopic bundled from `assets/fonts`. **The default text style is the Latin family; no component sets an Ethiopic-only family** (D2). **`includeFontPadding` appears nowhere** (D1).
- The generated API client from the committed `contracts/openapi.json`, behind `pnpm --filter mobile api:generate`, committed and never hand-edited.
- One route: a placeholder rendering the wordmark, "TikTok", "Instagram", a figure, and a line of Amharic, together.

**The agent configuration -- new in v1.2**

- **`.claude/skills/adulis-routing/SKILL.md`.** Its entire job is to say **which governed document answers which question** -- product behaviour to ADU-PRD, wire behaviour to ADU-API, schema to ADU-DB, authentication to ADU-AUTH, repository boundaries to ADU-REPO, mobile to ADU-MOB, privacy to ADU-DPIA, security to ADU-SEC. **It routes; it does not answer.** Where two documents conflict, it says to record the conflict, not to reconcile it.
- **`.claude/skills/adulis-unmechanized-invariants/SKILL.md`.** The rulings from **ADU-MOB-06 S8's last row** -- the ten with no mechanical check. **Format: invariant id, source document, section, what a reviewer must look at.** **Reference, never restate** -- the manual S13.2 and ADU-REPO-01 S6.
- **`.claude/agents/product-invariant-reviewer.md`.** Brief per the manual S14: it reads the diff, the applicable documents and the changed contracts, and asks *"did this change what Adulis is?"* **It must know that the FYP ruling is intentional** (ADU-MOB-AMD-02) and flag stale documents for amendment rather than rejecting authorised work.
- **Hooks in `apps/mobile/.claude/settings.json`**, per the manual S22 -- deterministic only: format and lint after a TS/TSX edit; typecheck, unit tests, the grep gates and a secret scan before a commit; **a confirmation gate on writes to `.env*`, signing configuration and credential files.**

**CI**

- **The mobile jobs added to ADU-REPO-01 S7's existing workflow** -- not a second workflow. Typecheck, lint, unit, `api:generate` diff, locale completeness, Maestro. **The fourteen gates join the repository-wide set**, never path-filtered.

### 0b.3 Do not build

Any screen beyond the placeholder  -  any network call  -  navigation beyond one route  -  App Links or Universal Links  -  push registration  -  any use of secure storage  -  any SQLite table  -  the camera  -  **any component beyond what the placeholder needs.**

**And specific to this slice:**

- **Do not install, upgrade or register any global tool, plugin or MCP server.** That is WO-0a and it is not yours. **If something is missing, say so and stop.**
- **Do not create `AGENTS.md`.** The instruction file is `apps/mobile/CLAUDE.md` (ADU-REPO-01 S8, manual S12). If an Expo starter generates one, remove it and note it in the PR.
- **Do not create a `docs/adr/` decision system.** Decisions live as numbered rulings in the ADU documents and as deferred items in ADU-VAL-01. A second one is duplicate truth.
- **Do not create the `fyp-ranking-reviewer` subagent yet.** The manual S15 requires it; **the FYP is not being built** (ADU-MOB-AMD-02 S H), and a reviewer with nothing to review is a file that goes stale before its first use.
- **Do not write any skill that restates a governed rule.** Manual S13, and it is the failure ADU-REPO-01 has already counted four times.

**Stop at the boundary and list what was not done.**

### 0b.4 The absences that bind this slice

**All fourteen gates exist as scripts from this commit, including the ones that trivially pass today** -- gate 3 guards a directory that does not exist yet, gate 10 guards a feature that was deleted, and gate 12 guards a package with one file. **Each is in place before the code that would trip it.**

### 0b.5 Gate

**Environment half** (P8, proven once) -- WO-0a S0a.2's five checks pass. **`/context` from `apps/mobile` loads no sibling workstream's instruction file.**

**CI half** -- `pnpm --filter mobile typecheck && lint && test` green, **from the repository root and from `apps/mobile`**  -  all fourteen gates present and passing  -  `api:generate` produces no diff  -  **`packages/tokens` imports nothing** (R-6)  -  an EAS **development** build completes for both platforms  -  **the font bundle is measured and recorded against the 30 MB budget** (D3).

**Configuration half** -- **the two skills exist and neither restates a rule**, proven by reading them: every rule is a citation  -  **`product-invariant-reviewer` runs against an empty diff and produces a coherent report**, which is how you find out its brief is wrong before it matters  -  **the pre-commit hook actually blocks a commit** when a gate fails, proven by breaking one on purpose.

**Emulator half** -- the placeholder renders in both locales.

**Device half** (deferred, P4) -- the development build installs on **both** reference devices and renders the placeholder with **no missing-glyph box** -- wordmark, both platform names and the figure as characters, beside the Amharic line, **at the largest OS text size**.

**Upload half** (deferred, P6) -- **a throwaway upload to App Store Connect passes the privacy-manifest check.**

### 0b.6 Review checklist

[ ] only `apps/mobile`, `packages/tokens` and the workspace manifest touched  [ ] the Expo SDK and RN versions are exact, not ranges  [ ] no dependency beyond the ADU-MOB-01 S3.7 list, and each new one named in the PR with whether it is a processor  [ ] **no global tool, plugin or MCP installed or changed by the agent**  [ ] `contracts/openapi.json` untouched  [ ] the fourteen gates exist as scripts, not as intentions  [ ] no App Links configuration present  [ ] **no hex literal outside `packages/tokens`**  [ ] **`includeFontPadding` appears nowhere**  [ ] the directory is `src/store/`  [ ] **no `AGENTS.md`**  [ ] **neither skill restates a rule that lives in a document**  [ ] the pre-commit hook was proven by breaking a gate.

---

## WO-1 -- Bootstrap, the floor, the clock, locale and errors

**Purpose:** the app can talk to the API correctly and refuse to run when it should. Nothing about identity yet.

### 1.1 Read first

ADU-MOB-01 v1.1 **S5, S5.1, S5.3, S6 in full, S12, S13**  -  **ADU-MOB-02 S3 (the state vocabulary), S3.4, S4.4, S4.6, and MB-00 and MB-05**  -  **ADU-MOB-03 S3.1 and H3**  -  ADU-API-01 **S3.1, S3.2, S7, S7.1, S7.1a, S12.1**  -  ADU-CON-02 **S9**  -  ADU-PRD-01 **S23, S23.1**  -  **the Engineering Manual S21, S22, S38**.

### 1.2 Build

- **`src/api/client.ts`, and it is the only file in the app that calls `fetch`.** Headers per ADU-MOB-01 S5: `X-Adulis-Client`, `X-Adulis-Device` (empty until WO-2), `X-Adulis-Clock-Offset`, `Accept-Language`, `Authorization` when a session exists, `Idempotency-Key` on every state-changing POST.
- The bootstrap module: **on cold start, and on foreground after a configured interval.** Stores `server_time` -> offset, market, locales, flags.
- **MB-00's bootstrap-failure behaviour, which is a screen and not a toast.** It retries with backoff, offers a manual retry, and **does not proceed with defaults**. **The clock offset survives; the floor is never cached** -- a stale floor is how a below-floor client keeps running.
- The three `client_status` behaviours: `OK` nothing; `UPGRADE_RECOMMENDED` **one dismissible banner per version**; `UPGRADE_REQUIRED` the blocking route.
- **MB-05**: reachable with no session, renders in both locales, **nothing routes past it** -- not a deep link, not a push tap. **No dismiss, no "later", no navigation.**
- The clock-offset store: **recorded and transmitted, never applied to a timestamp** (S6.4).
- Locale binding onto `packages/locale`; all formatting through `Intl` against the market timezone. **A Hermes `Intl` presence check** -- a stripped `Intl` renders every price and deadline wrong in exactly one locale.
- **The error mapper**: RFC 9457 Problem Details -> `message_key` + typed `slots` -> the catalogue. Every code in ADU-MOB-01 S5.1 gets its own rendering. **A 404 renders as not-found, never as a permission message.** `PERMISSION_DENIED` and `STEP_UP_REQUIRED` render as transport errors with the request id -- **on this surface they can only mean a client defect** (ADU-MOB-02 M2).
- **`H3 ErrorState`**, with `X-Adulis-Request-Id` in **selectable** text.
- **Default branches** on every closed-set render (ADU-MOB-02 S3.4).
- The Query provider: refetch on foreground, **no persister**.

### 1.3 Do not build

Device registration  -  OTP  -  session storage  -  deep links  -  push  -  any screen other than MB-00, MB-05 and a developer-only debug screen showing the bootstrap payload.

### 1.4 The absences that bind this slice

**No strict response schema** (B1)  -  **no closed render without a default branch**  -  **no `fetch` outside this module** (B5)  -  **no Query persister and no `/v1/*` body on disk** (S9.2)  -  **no timestamp corrected by the offset** (S6.4)  -  **no cached version floor.**

### 1.5 Gate

**CI half** -- unit tests covering **every** error code in ADU-MOB-01 S5.1, each rendering its own state  -  an unrecognised code, order state and scan outcome each render the default branch rather than a blank  -  a 404 renders as not-found  -  `Intl` is present in the Hermes build  -  gates 1 and 5 pass.

**Emulator half** -- with `min_supported_client` raised above the build, the app shows the blocking screen at launch and **no route reaches any other screen**  -  two consecutive bootstraps produce a stable offset  -  **a failed bootstrap renders MB-00's retry screen and does not proceed**  -  the blocking screen renders in `am` with no missing glyph.

**Device half** (deferred) -- the same four, on both reference devices, **at the largest OS text size**.

### 1.6 The two-version header, so nobody has to guess

> **Until the amendment is applied and the API's parser test passes, `X-Adulis-Client` sends the single-version form** -- `android/1.6.2`. Adding the binary version is a one-line follow-up.
>
> **Do not send the suffix ahead of the server.** The header is documented in its single form, and anything reading it with a strict pattern rejects **every app request** the day the app starts appending. That is a self-inflicted outage on the one header every request carries. **P1.**

### 1.7 Review checklist

[ ] `fetch` appears once  [ ] no response is validated against a schema  [ ] every closed-set render has a default  [ ] both locale entries exist for every new string  [ ] nothing from ADU-MOB-01 S14.2's redaction list is logged  [ ] the offset is transmitted and never applied  [ ] the floor is not cached  [ ] the request id is selectable  [ ] negative cases tested, not only the happy path.

---

## WO-2 -- Device, OTP, the age declaration and session

**Purpose:** an identity model that is correct in the four places it is usually wrong -- the device is not a credential, a 401 destroys one thing, request and resend are different endpoints, and the age checkbox is shown to everybody.

### 2.1 Read first

ADU-MOB-01 v1.1 **S4 in full, S5.2, S5.3, S14.1, S14.2**  -  **ADU-MOB-02 MB-04, MB-32, MB-36, and S4.1**  -  **ADU-AUTH-01 v2.8 S3, S4 (all), S5, S5.1, S5.2, S8, S17, S18, S19.1**  -  **ADU-RUL-04 S1**  -  ADU-API-01 **S5, S5.1, S12.2**  -  ADU-DB-01 **S6.4, S6.6, S11.1**  -  **ADU-MOB-06 S7 N5, N10, N11, N12**  -  **the Engineering Manual S25, S39**.

### 2.2 Build

- **Device id:** a UUIDv7 generated once, stored in **secure storage**, registered with `POST /v1/devices`, sent as `X-Adulis-Device` on every request thereafter. **Never regenerated** (B3). **The app validates the shape of its own device id before sending it and re-registers if it fails** -- a malformed header is answered with 500 and produces an unrecoverable loop.
- **No ordering discipline is owed.** ADU-RUL-04 S1: device creation is one function and both doors call it; the market is set at insert. **v1.0's trap no longer exists.**
- **Session:** the bearer token in secure storage, attached by the client module. **30 days absolute, no idle timeout** -- the app must handle an expiry that arrives without warning during an ordinary session.
- **MB-04, per ADU-MOB-02:** phone with prefix -> request -> code entry with autofill -> **the age checkbox, rendered for everyone** -> resend countdown -> change number.
- **Audience travels on the request** (`{ phone, purpose, audience }`), **and the verify call never carries it** (D-180). Grep gate 11.
- **The age declaration:** `age_declared_over_18` in the verify body; `AGE_DECLARATION_REQUIRED` rendered **at the checkbox**, never as a toast. **No date of birth is collected**, and the copy never describes self-declaration as verification.
- **Request and resend are the different endpoints they are:** a transport retry replays `POST /v1/auth/otp/request` with the stored key and **sends nothing**; the resend control calls `POST /v1/auth/otp/resend`, which carries no idempotency key.
- `OTP_SUPERSEDED` as **its own state**. Resend backoff **as a countdown, never as a rejected tap**. `RATE_LIMITED` with `Retry-After`, **byte-identically for a known and an unknown number**.
- **401 handling (B4):** clear the token; **keep the device id, the cart and the order idempotency key**; return to anonymous browsing.
- `roles[]` read for **one purpose only** -- the biometric default -- never as an authorisation input.
- Biometric or PIN unlock: **a local unlock, never a factor Adulis verifies.** Default off for a buyer-only account.
- **MB-36:** sessions list and **individual** revoke. **MB-32's sign-out**, with the confirmation saying the cart is kept.

### 2.3 Do not build

- **No `revoke-others` control.** `CONSOLE`-only (D-34). **Not a disabled one, not an explained one -- it does not exist on this surface.**
- **MB-37, delete my account** -- tier 8.
- Push registration and the token `PATCH` -- tier 8. **Note in the PR that ADU-MOB-01 S10.1 requires the token refreshed on every cold start, and that the SIM-swap control of ADU-AUTH-01 S7.2 depends on it**, so it is a tier 8 obligation and not an optional extra.
- Cart binding at first reserve -- tier 4  -  any seller surface, ever.
- **MB-32's delete entry is rendered, disabled, in its correct non-adjacent position** -- so the layout ruling M11 is established before the screen behind it exists.

### 2.4 The absences that bind this slice

**No token or device id in ordinary storage** (gate 2)  -  **no `X-Adulis-Seller`, no `as=seller`** (gate 6)  -  **no `revoke-others`**  -  **no `audience` in any auth request body** (gate 11)  -  **no authorisation decision taken from `roles[]`**  -  **no date of birth collected anywhere.**

### 2.5 Gate

**CI half** -- gates 2 and 11 pass  -  a 401 clears the token and **leaves the device id, the cart and the order idempotency key intact**  -  the resend path carries no idempotency key and the request path does  -  the rate-limit rendering is **byte-identical for a known and an unknown number**  -  a verify body containing `audience` is impossible to construct.

**Emulator half** -- sign in with an OTP read from `.dev-sms.log`  -  the device id is **one row across ten cold starts**  -  a server-side revoke ends access **on the next request**, and the device id, cart and key survive  -  a first sign-in with the box unticked returns `AGE_DECLARATION_REQUIRED` **and the screen says so at the checkbox**  -  the checkbox renders for a number that already has an account  -  `OTP_SUPERSEDED` renders its own message  -  the backoff renders as a countdown.

**Device half** (deferred) -- the device id survives a reinstall-free OS update  -  biometric unlock gates the stored token  -  SMS autofill works with the production message template  -  the whole flow at the largest OS text size, in Amharic  -  **the app container holds no token, phone number or code** after the flow.

### 2.6 Review checklist

[ ] the token and device id are in secure storage, proven by grep **and by inspecting the app container for the seeded phone number**  [ ] a 401 destroys exactly one thing  [ ] request and resend are not interchangeable  [ ] the age checkbox renders unconditionally  [ ] `roles[]` reaches nothing but the biometric default  [ ] no `audience` is sent on verify  [ ] the phone number, the code and the token appear in no log or breadcrumb  [ ] the device id's shape is validated before it is sent  [ ] sign-out and delete are not adjacent  [ ] both locale entries exist for every new string.

---

## 3. What tier 3 needs

**v1.0 listed three blockers. Two are gone.**

| Needs | State |
|---|---|
| **ADU-MOB-02** -- the storefront, product, search and lookup screens with their states | **Written.** MB-01 to MB-10 |
| **ADU-MOB-03** -- the components those screens are built from | **Written.** S3 |
| **The domain** -- `assetlinks.json` and `apple-app-site-association` have nowhere to live | **Still open (P5), and it now also blocks Apple enrolment.** WO-3 builds everything except the association, and defers the App Link half of its gate |
| **The embed decision** -- B8 holds unless a platform requires its SDK | Recorded, unverified. **The product screen must work with the embed never tapped**, which is the mitigation either way |
| **The device half of tiers 0-2** | A queue rather than a risk, provided `DEFERRED-GATES.md` is real |

> [!] **One scope change reaches tier 3 and is recorded here so it is not discovered there.** ADU-MOB-WO-02's WO-3 says *"MB-01, both lives."* **Build Life 1 only.** Life 2 is `GET /v1/feed`, which ADU-MOB-AMD-02 supersedes without a replacement designed yet. **Life 1 -- the two recovery paths -- is unchanged, is still a release gate, and is now also the FYP's cold-start surface** (AMD-02 B33). WO-3's gate line for it stands as written.

**Tier 3 onwards is ADU-MOB-WO-02.**

## 4. `DEFERRED-GATES.md` -- the template

Created in WO-0, appended by every order, emptied before tier 3 starts.

```text
# Deferred gates -- run when the reference devices arrive

## Tier 0
[ ] Development build installs on the reference Android and the reference iPhone
[ ] Placeholder renders wordmark, TikTok, Instagram, a figure and Amharic -- no glyph box
[ ] Same, at the largest OS text size
[ ] UPLOAD: a throwaway App Store Connect upload passes the privacy-manifest check

## Tier 1
[ ] Blocking screen at a raised floor, both devices, largest OS text size
[ ] Blocking screen in am, no glyph box
[ ] Bootstrap-failure screen renders and does not proceed
[ ] Clock offset stable across two bootstraps on a device with a wrong timezone

## Tier 2
[ ] Device id survives a reinstall-free OS update
[ ] Biometric unlock gates the stored token
[ ] SMS autofill works with the production message template
[ ] Full sign-in flow at the largest OS text size, in Amharic
[ ] App container holds no token, phone number or OTP after the flow
```

---

*Working instrument, v1.2, four slices across three tiers. **The change that matters is a split, and it comes from the manual rather than from this document.** Installing plugins, registering MCP servers and adding global tooling needs your authentication and changes your machine outside the repository -- so WO-0a is yours, executed once at a terminal, and WO-0b is the agent's. **An agent that can install its own capabilities has crossed the boundary the manual exists to hold**, and the manual says so in three separate sections. **WO-0b gains the half of the toolchain that genuinely is agent work**: two skills that route rather than restate, one reviewer whose only question is whether the change altered what Adulis is, and hooks that prove deterministic things deterministically. **Its gate now includes breaking a gate on purpose**, because a pre-commit hook nobody has seen fail is a hook nobody knows is wired. The largest closure from v1.1 stands -- the age declaration is built and WO-2 builds the screen -- and the one blocker that is neither devices nor a domain is still two documents disagreeing about the body of the request the whole of tier 2 is built around.*
