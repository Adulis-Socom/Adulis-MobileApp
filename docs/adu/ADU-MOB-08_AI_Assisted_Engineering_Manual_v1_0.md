# ADULIS MOBILE AI-ASSISTED ENGINEERING MANUAL

**Document:** ADU-MOB-08  -  **Version:** 1.0
**Status:** Approved development-process instruction
**Effective date:** 7 September 2026
**Primary workstream:** `apps/mobile/`
**Primary stack:** React Native + Expo + TypeScript
**Purpose:** Define how AI coding agents, Claude Code plugins, MCP servers, skills, subagents, deterministic automation, mobile testing, and recommendation-system development must be used while building the Adulis mobile application.
**Encoding:** ASCII.

---

# 1. PRIME RULE

Adulis is a governed software project.

An AI agent is an implementation tool. It does not have authority to silently redefine the product, architecture, security model, data model, API contract, trust model, payment model, or release policy.

The operating order is:

```text
Approved product decision
        v
Governed Adulis documents
        v
Architecture/API/schema amendment when required
        v
Work order
        v
Implementation
        v
Deterministic verification
        v
Independent/adversarial review
        v
Device/E2E verification
        v
Human review
        v
Release
```

When code and a governing document disagree, do not normalize the disagreement by making the code "work."

Determine whether:

1. the code is wrong, or
2. the product decision has intentionally changed and the document now needs amendment.

The second case is especially important for the FYP change described below.

---

# 2. NEW PRODUCT RULING - FYP REPLACES THE OLD FEED MODEL

This is a recent approved product change.

Adulis will build a personalized **For You Page (FYP)**.

The previous followed-sellers-only chronological feed model is superseded wherever it conflicts with this decision.

The FYP is a core product system, not merely a renamed chronological feed.

The system is expected to support:

- personalized ranking;
- infinite discovery;
- cross-seller discovery;
- candidate generation;
- exploration of unfamiliar sellers/products;
- exploitation of known interests;
- content and product relevance;
- watch-time measurement;
- FYP engagement measurement;
- recommendation-performance measurement;
- product-click measurement;
- seller-profile visits;
- saves/wishlists;
- follows;
- cart/reservation behavior;
- completed-commerce outcomes;
- negative-feedback signals;
- trust and safety constraints;
- inventory/availability constraints;
- seller and content diversity.

Therefore any older statement equivalent to:

```text
"the feed is only a recency query"
"there is no recommender"
"there is no cross-seller discovery"
"ranking must not exist"
```

must not be used to reject the new FYP requirement.

However:

**do not silently code around the old contracts.**

Where existing ADU-PRD, ADU-API, ADU-DB, ADU-MOB, analytics or privacy documents encode the previous feed-only architecture, first identify the conflict and prepare the required amendment.

The correct sequence is:

```text
new FYP ruling
    v
identify affected documents
    v
update API/data/privacy/mobile architecture
    v
then implement
```

Do not attempt to preserve contradictory old and new architectures simultaneously merely to keep both documents technically true.

---

# 3. WHAT THE FYP IS OPTIMIZING

Adulis is not TikTok.

TikTok-style interaction patterns may inspire the browsing experience, but Adulis is a commerce platform.

Therefore **raw watch time must never become the only ranking objective**.

Watch time is useful evidence of interest, not the final business outcome.

The ranking system should eventually optimize a multi-objective value function containing signals such as:

```text
meaningful view probability
watch quality
product-detail click probability
save/wishlist probability
seller-profile interest
follow probability
cart probability
reservation probability
completed-order probability
completed-handoff probability

minus

rapid-skip probability
hide/not-interested probability
report probability
fraud/trust risk
unavailable-stock risk
excessive seller repetition
poor diversity
```

Commerce outcomes should increasingly outweigh shallow engagement as enough data becomes available.

A product that produces long sessions but few useful shopping actions is not automatically a successful FYP.

---

# 4. FYP MVP - DO NOT BUILD TIKTOK'S INFRASTRUCTURE

The first Adulis recommender must be intentionally simple.

Do not begin with:

- deep neural ranking;
- reinforcement learning;
- a feature store;
- Kafka solely for recommendations;
- vector databases merely because recommenders often use them;
- online model training;
- large model-serving infrastructure;
- dozens or hundreds of ranking features;
- multiple ranking microservices;
- heavy experimentation infrastructure.

The recommended initial architecture is:

```text
eligible content/products
        v
candidate generation
        v
simple feature extraction
        v
weighted/rule-based ranking
        v
trust/inventory/business filtering
        v
diversity/exploration adjustment
        v
FYP
        v
high-quality event collection
        v
evaluation
        v
later learned ranking when data justifies it
```

The initial objective is not maximum algorithm sophistication.

The initial objective is:

> generate trustworthy behavioral data while providing a useful personalized discovery experience.

---

# 5. SERVER OWNS RANKING

The mobile application must not determine the authoritative ranking algorithm.

The client asks for FYP results.

The server determines:

- eligible candidates;
- ranking;
- filtering;
- trust restrictions;
- exploration;
- diversity;
- inventory eligibility;
- ranker version.

Avoid APIs such as:

```text
?ranking=watch_time
?sort=engagement
?algorithm=model_b
?recommended=true
```

unless an internal operator/debug contract explicitly requires them.

Normal production clients should not choose the ranking algorithm.

This allows ranking logic to evolve without requiring every installed app to update.

---

# 6. FYP EVENT INSTRUMENTATION IS LOAD-BEARING

A recommender without trustworthy exposure data cannot be evaluated.

Before sophisticated ranking work, establish a canonical event model.

Likely FYP events include:

```text
fyp_session_started
fyp_impression
fyp_view_started
fyp_meaningful_view
fyp_view_completed
fyp_rewatch
fyp_skip
fyp_product_opened
fyp_seller_opened
fyp_saved
fyp_followed
fyp_cart_added
fyp_reservation_started
fyp_reservation_completed
fyp_hidden
fyp_reported
```

The exact names belong in the governed analytics/event catalogue.

Do not allow individual screens to invent event names.

Every recommendation exposure should be attributable to sufficient evaluation context, for example:

```text
event_id
account/session pseudonymous identifier
fyp_session_id
request/page identifier
impression_id
content/product identifier
seller identifier
candidate source
position
ranking version
event schema version
client version
event timestamp
relevant duration where applicable
```

Collect only what is necessary.

Never place secrets, OTPs, authentication tokens, payment evidence, unrestricted chat text, identity-document data, or similarly sensitive payloads in analytics events.

---

# 7. WATCH TIME MUST HAVE ONE DEFINITION

Do not allow each component to define "watch time" differently.

A governed metric definition must specify:

- when timing starts;
- minimum visibility threshold;
- whether muted playback counts;
- when timing pauses;
- what happens when the app backgrounds;
- what happens when another element covers the content;
- how repeated views are counted;
- how image dwell time differs from video watch time;
- how buffering is treated;
- how very short accidental exposures are treated.

Do not measure:

```text
screen mounted duration
```

and call it watch time.

Measure actual meaningful visible consumption.

---

# 8. FYP EVALUATION

The system must evaluate both engagement and commerce.

## Primary recommendation metrics may include

- meaningful-view rate;
- watch time per impression;
- completion rate;
- rapid-skip rate;
- product-detail CTR;
- save/wishlist rate;
- seller-profile CTR;
- follow rate;
- cart rate;
- reservation-start rate;
- reservation-completion rate;
- completed-handoff rate;
- repeat FYP usage.

## Guardrail metrics must include

- report rate;
- hide/not-interested rate;
- low-trust content exposure;
- unavailable-product exposure;
- seller concentration;
- category concentration;
- recommendation diversity;
- new-seller exposure;
- latency;
- crash/ANR impact;
- mobile data consumption;
- battery/performance impact.

Never declare a ranking change successful because watch time increased while commerce quality, trust, diversity, or user safety degraded.

---

# 9. RECOMMENDATION BIAS AND DATA-QUALITY RULES

FYP metrics are not automatically ground truth.

The system must account for:

- position bias;
- exposure bias;
- selection bias;
- popularity feedback loops;
- cold-start users;
- cold-start sellers;
- bot/manipulated engagement;
- repeated self-interaction;
- fake views;
- sparse commerce outcomes;
- delayed transaction outcomes;
- exploration traffic;
- deleted/unavailable products;
- model/ranker version differences.

A product shown in position 1 receiving more clicks than a product shown in position 20 does not by itself prove that it is intrinsically more relevant.

Record ranking/exposure context so later analysis can distinguish these effects.

---

# 10. INFINITE DISCOVERY DOES NOT MEAN UNBOUNDED CLIENT WORK

The FYP must feel continuous while remaining bounded.

Required principles:

- cursor-based continuation;
- bounded page sizes;
- bounded prefetch;
- cancel obsolete requests;
- virtualize off-screen content;
- release inactive media resources;
- prevent multiple videos from unnecessarily decoding simultaneously;
- do not retain unlimited FYP history in memory;
- do not preload the entire next session;
- prioritize low-end Android performance;
- measure actual device performance.

The mobile client must remain usable on modest devices and constrained connections.

---
# 11. REPOSITORY STRUCTURE IS ALREADY GOVERNED

Do not restructure the repository into a generic React Native project.

The platform is a monorepo with separate workstreams.

The mobile application belongs under:

```text
apps/mobile/
```

Shared functionality belongs under approved `packages/*` seams.

Never import from one `apps/*` workstream directly into another.

Do not create a root-level generic `src/` architecture that bypasses the existing monorepo design.

The existing dependency rules remain:

```text
apps/*      -> may import packages/*
apps/*      -> may NOT import another apps/*
packages/*  -> may NOT import apps/*
packages/*  -> may import packages/* only acyclically
```

Shared functionality that genuinely belongs to multiple applications should be promoted deliberately into a package rather than reached through another application's source tree.

---

# 12. CLAUDE CODE SESSION RULE

Mobile Claude sessions should start from:

```bash
cd apps/mobile
claude
```

Do not normally start mobile implementation sessions from the repository root.

The project already relies on per-workstream Claude instructions and permissions.

Keep:

```text
root CLAUDE.md
apps/mobile/CLAUDE.md
apps/mobile/.claude/settings.json (superseded by D-25: moved to <repo-root>/.claude/settings.json)
```

aligned with the repository-governance design.

Do not introduce additional competing instruction files merely because Expo's default starter project uses them.

If Expo guidance from `AGENTS.md` is valuable, route or incorporate that guidance through the existing Adulis instruction hierarchy rather than creating a second authoritative Adulis rule set without an explicit repository-governance amendment.

---

# 13. DO NOT COPY THE ADU CORPUS INTO CLAUDE SKILLS

Adulis already has extensive governed documentation.

Do not create skills such as:

```text
adulis-order-flow
adulis-auth
adulis-trust
adulis-database
adulis-mobile-architecture
```

by copying rules from the ADU documents.

That creates duplicate truth.

Duplicate truth eventually becomes conflicting truth.

Use only two project-specific skill classes initially.

## 13.1 `adulis-routing`

Its job is only to determine which governed document answers a question.

Example:

```text
product behavior       -> ADU-PRD
API/wire behavior      -> ADU-API
schema/invariants      -> ADU-DB
authentication/RBAC    -> ADU-AUTH
repository boundaries  -> ADU-REPO
mobile architecture    -> ADU-MOB
privacy/data handling  -> ADU-DPIA
security               -> ADU-SEC
```

If two documents conflict, consult the project's document-authority mechanism.

Do not invent reconciliation.

## 13.2 `adulis-unmechanized-invariants`

This contains references to important rulings for which no deterministic gate currently exists.

Prefer:

```text
Invariant ID
source document
section
what must be reviewed
```

over duplicating the entire rule text.

---

# 14. REQUIRED CUSTOM SUBAGENT - PRODUCT INVARIANT REVIEWER

Create:

```text
product-invariant-reviewer
```

This agent reviews the implementation independently from the implementation agent.

Its question is:

> "Did this change accidentally change what Adulis is?"

It should inspect:

- the git diff;
- applicable governed documents;
- relevant rulings;
- changed API contracts;
- changed migrations;
- changed permissions;
- changed analytics definitions.

It specifically looks for "helpful" generic marketplace behavior that Adulis did not authorize.

Examples:

- Adulis holding buyer money;
- automatic payment verification;
- courier marketplace behavior;
- unauthorized seller actions;
- duplicated sources of truth;
- client-side authorization;
- hidden product-policy changes;
- pricing/subscription UI where forbidden;
- new processors/SDKs without review.

The reviewer must also understand that the **new FYP ruling is intentional** and must not reject ranking, recommendation, infinite discovery, watch-time measurement, or cross-seller discovery merely because older documents still describe the former feed.

Instead it should flag those documents for amendment.

---

# 15. REQUIRED CUSTOM SUBAGENT - FYP RANKING REVIEWER

Create:

```text
fyp-ranking-reviewer
```

Its purpose is not to build the recommender.

Its purpose is to challenge it.

It should ask:

```text
Are impressions recorded correctly?
Is watch time measured correctly?
Can a user/seller manufacture engagement?
Can one seller monopolize the FYP?
Can unavailable stock be recommended?
Can untrusted/restricted content bypass eligibility?
Is there adequate exploration?
Is there adequate diversity?
Is candidate generation leaking information?
Is position bias ignored?
Is future information leaking into evaluation?
Are experiments comparable across ranking versions?
Are client events idempotent/deduplicated?
Could retries double-count engagement?
Does ranking optimize shallow engagement at the expense of commerce?
```

For algorithm changes, this reviewer should be independent of the agent that implemented the change.

---

# 16. OPTIONAL SPECIALIST AGENTS

Do not create many permanent subagents by default.

Use additional specialists only when their scope earns them.

Useful examples:

```text
mobile-performance-reviewer
security-reviewer
accessibility-reviewer
test-reviewer
```

Prefer direct work for small tasks.

Use subagents when:

- independent judgment matters;
- a large feature crosses multiple concerns;
- tasks can truly run in parallel;
- isolated context reduces assumption contamination.

---
# 17. APPROVED CLAUDE/DEVELOPMENT TOOLSET

## Tier A - install/use now

### 17.1 Expo official Claude plugin

Purpose:

- current Expo guidance;
- Expo Skills;
- Expo MCP;
- SDK-aware package workflows;
- EAS build inspection;
- build logs;
- development assistance.

Install:

```bash
claude plugin install expo@claude-plugins-official
```

Then authenticate inside Claude Code:

```text
/mcp
```

Do not separately register Expo MCP if the plugin already registered it.

---

### 17.2 TypeScript language server / LSP

Required for strict TypeScript engineering.

Install the language server:

```bash
npm install -g typescript-language-server typescript
```

Use the official TypeScript LSP Claude integration available through the Claude plugin marketplace.

It is useful for:

- definitions;
- references;
- TS/TSX understanding;
- type diagnostics;
- refactoring awareness.

---

### 17.3 Context7

Use for current third-party library documentation.

Install from the official Claude plugin marketplace:

```text
/plugin install context7@claude-plugins-official
```

Priority order for technical truth:

```text
Adulis governed architecture
        v
official Expo documentation
        v
library's official documentation
        v
Context7 current documentation
        v
model prior knowledge
```

Context7 may explain how a library works.

It may not decide that Adulis should use that library.

---

### 17.4 GitHub integration

Use the official GitHub integration for:

- issues;
- PRs;
- diff context;
- review conversations;
- repository metadata.

Do not grant destructive repository privileges simply because the integration supports them.

---

### 17.5 Maestro

Maestro remains the canonical deterministic mobile E2E framework.

Use it for persistent regression journeys.

Canonical examples include:

- deep-link entry;
- sign-in;
- reservation;
- payment evidence;
- handoff scan;
- claims;
- FYP critical journeys as they are introduced.

Maestro YAML belongs in source control.

A discovered production bug should produce a regression flow when appropriate.

---

### 17.6 agent-device

Use agent-device for exploratory and AI-driven device verification.

Human-owned setup:

```bash
npm install -g agent-device@latest
```

Check the installed Node version before relying on it.

Do not allow the coding agent to autonomously download or upgrade mutable global tooling.

Use agent-device for:

- launching the React Native/Expo app;
- tapping;
- typing;
- scrolling;
- screenshots;
- UI inspection;
- logs;
- React Native debugging;
- network/runtime evidence;
- exploratory QA;
- reproducing bugs;
- visual verification.

Treat agent-device and Maestro differently:

```text
agent-device
    = exploration, diagnosis, visual/device evidence

Maestro
    = durable regression automation
```

Do not replace one with the other.

---

### 17.7 Security Guidance

Install:

```text
/plugin install security-guidance@claude-plugins-official
```

Use as an additional security reviewer.

It is not proof of security.

Existing database constraints, API authorization, RBAC, security tests, secret scans and human review remain authoritative.

If the plugin's agentic commit-review layer produces unacceptable token/cost or workflow overhead, the expensive layer may be disabled while retaining the deterministic/prompt-level protections, subject to engineering review.

---

### 17.8 PR Review Toolkit

Install:

```text
/plugin install pr-review-toolkit@claude-plugins-official
```

Use it to independently inspect areas such as:

- test quality;
- error handling;
- type design;
- code quality;
- simplification.

Its role differs from the Adulis invariant reviewer:

```text
PR toolkit:
"Is this good software?"

product-invariant-reviewer:
"Is this still the intended Adulis?"
```

Both are useful.

---

# 18. DEFERRED TOOLING

## Figma

Use once the mobile design/wireframe source of truth reaches implementation readiness.

Figma integration is useful for:

- exact layout context;
- design tokens;
- component inspection;
- implementation comparison.

It is not required for architectural/backend/FYP work before those designs exist.

---

## React Native performance skills

Useful when performance work becomes measured rather than speculative.

Do not use them as justification for broad refactoring.

Profile first.

Optimize the observed bottleneck.

This becomes especially important for FYP:

- virtualized lists;
- image/video memory;
- excessive renders;
- JS-thread blocking;
- startup;
- media lifecycle;
- scrolling FPS.

---

# 19. NOT APPROVED FOR MVP MOBILE BINARY WITHOUT REOPENING ARCHITECTURE

Do not embed third-party mobile SDKs merely for convenience.

The existing mobile architecture intentionally restricts third-party SDKs because adding a processor/data flow has privacy and dependency consequences.

Therefore do not currently introduce:

- PostHog React Native SDK;
- Sentry React Native SDK;
- session replay SDKs;
- third-party attribution SDKs;
- advertising SDKs;
- unnecessary analytics SDKs.

This does **not** mean Adulis will have no analytics.

The FYP makes analytics mandatory.

At MVP, prefer **first-party event instrumentation through the Adulis backend**.

Later, third-party analytics/observability can be reconsidered through the documented privacy/security/dependency review process.

---

# 20. DO NOT ADD BACKEND ALTERNATIVES THAT ADULIS DID NOT CHOOSE

Do not introduce:

```text
Firebase
Supabase
Prisma
MongoDB
another BFF
another mobile backend
```

simply because an MCP/plugin exists.

The current platform already has a governed backend/database architecture.

External integrations should solve a real gap, not create a parallel architecture.

---

# 21. DEPENDENCY RULE FOR AI AGENTS

AI coding agents tend to solve local problems by installing packages.

For Adulis:

**a new dependency is an architecture/dependency decision, not merely a code edit.**

Before proposing a dependency, the agent must determine:

1. Can the existing stack solve the problem?
2. Is the dependency already approved in the manifest?
3. Is it Expo/React Native compatible?
4. Does it require native rebuilds?
5. Does it collect or transmit personal data?
6. Does it introduce another processor?
7. Does it affect permissions?
8. Does it affect bundle/binary size?
9. Is it actively maintained?
10. What capability does it buy that justifies the cost?

Do not autonomously install a package and then design the architecture around it.

---

# 22. DETERMINISTIC RULES BELONG IN HOOKS/CI

Do not ask an LLM to verify something a command can prove completely.

Examples:

```text
typecheck
lint
format
forbidden imports
forbidden API usage
secret scan
dependency boundaries
event-name registry
forbidden analytics SDKs
forbidden billing language
client-side crypto prohibition
generated-contract drift
```

should be enforced mechanically whenever practical.

AI review should focus on things requiring judgment.

---

# 23. EXISTING GATES MUST BE REUSED, NOT REWRITTEN

Do not create another generic "Definition of Done" that competes with Adulis's release gates.

The workstream already has product-specific requirements.

Automation should execute those requirements.

Examples include:

- generated API consistency;
- strict typecheck;
- lint;
- unit tests;
- dependency checks;
- grep gates;
- Maestro;
- physical-device verification;
- Ge'ez/Amharic validation;
- release/device checks.

A new checklist must add a genuinely new requirement, not restate an existing one.

---

# 24. NEW FYP DETERMINISTIC GATES

As the FYP architecture is formalized, add mechanical checks such as:

```text
No FYP event name outside the canonical event catalogue.

No direct FYP analytics HTTP calls outside the approved
instrumentation module.

No third-party analytics SDK import.

No client-controlled production ranking algorithm.

Every ranking response exposes/records a ranker version internally
where required for evaluation.

Every impression has an impression identifier.

No event payload can contain authentication tokens, OTPs,
identity-document values or payment evidence.

No unbounded FYP fetch/list configuration.

No application import crossing apps/* boundaries.
```

Prefer executable checks over prose reminders.

---
# 25. DEVELOPMENT ACCESS MODEL

AI capability must be separated by environment.

## Development

Claude may generally:

- edit code;
- run tests;
- inspect local services;
- use development devices/emulators;
- use local development databases;
- generate preview artifacts.

## Preview/Staging

Claude may:

- inspect builds;
- inspect logs;
- run device/E2E tests;
- prepare builds;
- perform approved preview workflows.

Write privileges should be bounded.

## Production

Default:

```text
READ
INSPECT
DIAGNOSE
PREPARE
```

not:

```text
PUBLISH
SUBMIT
MIGRATE
DELETE
ALTER
```

Production mutations require explicit human authorization.

---

# 26. EXPO/EAS CREDENTIAL RULE

This is critical.

Expo MCP can do more than read documentation.

It may be capable of actions including store build submission.

EAS Update can also change JavaScript running in already-installed applications.

Therefore Expo/EAS credentials are production code-execution credentials.

An AI agent must never gain unrestricted permanent authority to:

- publish production OTA updates;
- submit builds to Google Play;
- submit builds to App Store Connect;
- mutate production release channels;
- change sensitive signing/release configuration.

The normal Claude workflow may inspect and prepare.

Production publication requires the established release approval process.

---

# 27. OTA UPDATE RULE

An OTA update is not "just content."

It changes executable JavaScript in installed applications.

Use OTA only within the governed update policy.

Do not use OTA as a way to bypass store review for:

- new native permissions;
- new data collection;
- new native capabilities;
- privacy-label changes;
- materially changed application purpose;
- behavior that should receive store review.

Every production OTA must be attributable to a source revision and capable of rollback.

---

# 28. PHYSICAL-DEVICE TESTING REMAINS REQUIRED

AI/device automation narrows manual QA.

It does not eliminate it.

Some release conditions require physical-world evidence.

Examples include:

- real Ge'ez rendering;
- largest OS text size;
- camera/scan reliability;
- QR scanning in poor real lighting;
- outdoor scan legibility where applicable;
- push behavior;
- SMS/autofill behavior;
- App Links/Universal Links;
- low-end Android performance;
- accessibility and evidence legibility.

Do not convert a physical-device requirement into an emulator requirement merely because the emulator is easier to automate.

---

# 29. MOBILE TEST PYRAMID

Use complementary layers.

## Unit

For pure logic, ranking utilities, formatters, reducers and deterministic calculations.

## Integration

For API client behavior, state/query boundaries, persistence, analytics instrumentation and component interactions.

## Maestro

For canonical end-to-end journeys.

## agent-device

For exploratory QA, reproduction, screenshots, logs, performance evidence and AI-operated device checking.

## Physical human/device release pass

For things automation cannot credibly establish.

Each layer exists because the others cannot prove everything.

---

# 30. FYP PERFORMANCE TESTING

FYP performance is a product feature.

Test at least:

- scroll smoothness;
- memory growth through long sessions;
- media teardown;
- image/video loading;
- cancellation of obsolete work;
- data use;
- startup cost;
- FYP API latency;
- time to first usable recommendation;
- low-end Android behavior;
- behavior on slow/intermittent networks.

Do not optimize based only on a flagship development phone.

---

# 31. SECURITY OF THE FYP

Recommendation systems create new abuse surfaces.

Threats to consider include:

- fake watch time;
- click farms;
- seller self-engagement;
- coordinated manipulation;
- content spam;
- malicious uploads;
- recommendation poisoning;
- report brigading;
- fake new accounts;
- replayed analytics events;
- event flooding;
- attempts to infer private user interests.

The recommender must consume trust/safety eligibility rather than becoming a route around it.

Ranking must never override:

```text
content prohibition
seller suspension
inventory invalidity
authorization
privacy restrictions
```

---

# 32. OBSERVABILITY OF RECOMMENDATION CHANGES

Every ranking change should be attributable.

Record enough information to answer:

```text
Which ranker produced this result?
Which candidate source produced this item?
At what position?
For which experiment/config?
Under which client version?
What changed between the healthy and unhealthy period?
```

Do not deploy ranking changes that cannot later be identified in production data.

---

# 33. EXPERIMENTATION RULE

Do not introduce uncontrolled A/B experimentation immediately.

First ensure:

- event definitions are stable;
- assignment is deterministic;
- exposure is recorded;
- users remain in their assigned cohort as required;
- metrics are trustworthy;
- experiment version is recorded;
- privacy implications are understood.

Experiments must have:

```text
hypothesis
primary metric
guardrail metrics
target population
duration/decision rule
rollback condition
```

Do not search dozens of metrics after an experiment and declare whichever improved the winner.

---

# 34. FYP COLD START

The system must work before a user has behavioral history.

Candidate sources may include a controlled mixture of:

- followed sellers where applicable;
- recent eligible content;
- categories selected or inferred from explicit actions;
- local/market relevance;
- popular but trustworthy content;
- new-seller exploration;
- diversified discovery.

Do not equate popularity with relevance.

Do not permanently starve new sellers because they lack historic engagement.

Exploration must be deliberate.

---

# 35. PRODUCT-INVARIANT REVIEW ORDER FOR FYP CHANGES

Before accepting an FYP implementation, review in this order:

```text
1. Eligibility
2. Authorization/privacy
3. Inventory correctness
4. Trust/safety
5. Event correctness
6. Candidate correctness
7. Ranking correctness
8. Diversity/exploration
9. Performance
10. Commerce and engagement outcomes
```

A brilliant ranker over an invalid candidate set is a broken system.

---

# 36. STANDARD FEATURE WORKFLOW

For a non-trivial mobile feature:

```text
1. Read applicable governed documents.
2. Check whether the recent FYP ruling affects them.
3. Identify conflicts before coding.
4. Produce amendment/work-order when necessary.
5. Inspect current code.
6. Consult official/current library docs.
7. Implement the smallest compliant solution.
8. Run deterministic checks.
9. Run relevant unit/integration tests.
10. Run affected Maestro journey.
11. Use agent-device where visual/device evidence matters.
12. Run product-invariant-reviewer.
13. For FYP changes, run fyp-ranking-reviewer.
14. Run security/code review.
15. Record unresolved questions instead of inventing answers.
16. Human review.
```

---

# 37. BUG-FIX WORKFLOW

For a bug:

```text
reproduce
    v
capture evidence
    v
identify violated invariant
    v
write regression test when practical
    v
make smallest fix
    v
run affected gates
    v
verify on device if relevant
```

Do not opportunistically refactor unrelated parts of the codebase during a bug fix unless the fix genuinely requires it.

---

# 38. AI AGENT ANTI-OVERENGINEERING RULE

The AI must not interpret "professional" as "maximal architecture."

Prefer:

```text
one module over a framework
one table over a service
one deterministic rule over an ML model
one existing dependency over a new dependency
one first-party event endpoint over a third-party analytics SDK
```

when the smaller solution satisfies the requirement.

Build for the first real users while preserving seams that allow later growth.

---

# 39. QUESTIONS THE AI MUST NOT ANSWER BY INVENTION

When no governing source settles a consequential issue, record it.

Examples:

- a new authorization path;
- a new trust penalty;
- a new payment responsibility;
- a new subscription entitlement;
- a new processor;
- a new retention period;
- a new ranking-policy objective;
- a new seller eligibility rule;
- a new data field containing personal information.

The correct output is:

```text
Finding / question
Why it matters
Affected documents/code
Safe temporary boundary, if one exists
Ruling required
```

not a plausible invented feature.

---

# 40. TOOLS THAT SHOULD NOT BE INSTALLED JUST BECAUSE THEY EXIST

Do not add:

- generic filesystem MCP where Claude already has filesystem access;
- "sequential thinking" MCP;
- generic memory MCP as a substitute for governed documentation;
- multiple overlapping database MCPs;
- Firebase/Supabase tooling for an architecture that does not use them;
- Playwright as the primary native-app testing solution;
- dozens of generic coding plugins;
- autonomous deployment agents with production credentials.

Every tool increases:

- context;
- permissions;
- maintenance;
- attack surface;
- cognitive complexity.

A smaller trusted toolchain is preferred.

---

# 41. RECOMMENDED CORE TOOLCHAIN SUMMARY

```text
GOVERNANCE
--------------------------------
Root CLAUDE.md
apps/mobile/CLAUDE.md
per-app .claude/settings.json
ADU documents
adulis-routing skill
adulis-unmechanized-invariants skill

IMPLEMENTATION INTELLIGENCE
--------------------------------
Expo official plugin
TypeScript LSP
Context7

SOURCE CONTROL / REVIEW
--------------------------------
GitHub integration
PR Review Toolkit
Security Guidance
product-invariant-reviewer
fyp-ranking-reviewer

MOBILE VERIFICATION
--------------------------------
Maestro
agent-device
physical reference devices

AUTOMATION
--------------------------------
existing CI
hooks
grep/invariant gates
typecheck
lint
unit/integration tests
secret scanning

FYP DATA
--------------------------------
first-party analytics instrumentation
canonical event catalogue
ranker/candidate versioning
recommendation evaluation
```

---

# 42. CURRENTLY DEFERRED / REJECTED

```text
PostHog mobile SDK          DEFER
Sentry mobile SDK           DEFER
session replay              REJECT MVP
Firebase backend            REJECT
Supabase backend            REJECT
generic Memory MCP          REJECT
Sequential Thinking MCP     REJECT
Playwright for native app   NOT PRIMARY
large custom skill library  REJECT
full ML recommender         DEFER UNTIL DATA
```

Figma becomes approved when the mobile design source of truth is ready for implementation.

---

# 43. DEVELOPMENT PHILOSOPHY

The purpose of these tools is not to let Claude write more code.

The purpose is to increase the percentage of code that is:

```text
correct
product-compliant
secure
testable
observable
measurable
reviewable
reproducible
```

The engineering system should make an AI agent powerful **inside boundaries**, not powerful instead of boundaries.

---

# 44. FINAL OPERATING PRINCIPLE

For Adulis:

```text
Documents define intent.
Contracts define interfaces.
Database/server controls define authority.
Tests prove repeatable behavior.
Devices prove real mobile behavior.
Analytics prove what users actually do.
Recommendation evaluation proves whether FYP changes help.
Humans retain authority over product rulings and production releases.
AI accelerates everything between those boundaries.
```

The new FYP is a major architectural evolution, but it does not invalidate the disciplined engineering system already built around Adulis.

Use the same principle for the recommender that Adulis uses everywhere else:

> **make assumptions explicit, make deterministic rules executable, measure what cannot be inferred, and never let an AI silently turn a plausible convention into a product decision.**