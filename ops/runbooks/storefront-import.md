# Runbook - importing the storefront website (ADU-REPO-01 S10, S11 step 4)

**Status: NOT DONE. Blocked on one input.**

[!] **The URL of the storefront repository is not recorded in any document available
here.** It is the single input this step needs and the one thing that must not be
guessed. Supply it and this runbook is a two-minute job.

---

## Why `apps/storefront/` does not exist yet

ADU-REPO-01 S11 orders the landing as: **step 1** governance, including a per-app
`CLAUDE.md` for every workstream; **step 4** the storefront by subtree import. **Those
two steps conflict**, and the conflict is silent until you hit it:

```
$ mkdir -p apps/storefront && echo x > apps/storefront/CLAUDE.md && git add -A && git commit
$ git subtree add --prefix apps/storefront <url> main
fatal: prefix 'apps/storefront' already exists.
```

`git subtree add` refuses a prefix that exists. Verified empirically, not assumed.
Creating the placeholder first would therefore have broken step 4 - so the directory is
deliberately absent and its `CLAUDE.md` is staged here instead.

**Reported for ADU-REPO-01 v1.1:** step 1 should exclude the storefront, or step 4
should read *"import first, then add its `CLAUDE.md`."*

---

## The import

```bash
# 1. Import, preserving history. NOT a copy-paste - a copy-paste loses it.
git subtree add --prefix apps/storefront <STOREFRONT_REPO_URL> main

# 2. Add the workstream instruction file (the block at the end of this runbook).
#    Do this AFTER the import, never before.
$EDITOR apps/storefront/CLAUDE.md

# 3. Give it an owner. Until then it has no CODEOWNERS line, which is deliberate -
#    an owner invented for an unstaffed workstream is a review nobody performs.
$EDITOR .github/CODEOWNERS

# 4. Confirm the workspace picked it up and the boundary holds.
pnpm install
pnpm verify:deps          # rules 1-4; the storefront must not import from apps/*
pnpm --filter @adulis/storefront build
```

**What comes with it:** the Tier 2 stubs, route-prefixed i18n and the `AM_ENABLED` flag.

**What must NOT be harmonised afterwards:** its CSP keeps the nonce. Next.js injects
inline bootstrap scripts, so `script-src 'self'` alone cannot work there - and that is
the entire reason the console is Vite and not Next.js. A nonce that exists is a nonce
that can be leaked; the console does not have one because it does not need one.

**Later updates:** `git subtree pull --prefix apps/storefront <url> main`.

---

## The file to add at step 2

Save the block below as `apps/storefront/CLAUDE.md`.

```markdown
# `apps/storefront` — the public storefront website

**PLACEHOLDER. The application lives in its own repository and has not been imported
yet (ADU-REPO-01 S10). This workstream is unassigned.**

Loaded together with the root `CLAUDE.md`. Start your session here, not at the
repository root.

**Governing documents:** ADU-WEB-01 v1.0 - ADU-API-01 v1.6 S12.1, S10.1 -
ADU-SEC-01 v1.0 - ADU-REPO-01 S10.

## How it arrives

```
git subtree add --prefix apps/storefront <url> main
```

**Subtree, not a copy-paste** - it preserves the history a copy-paste loses. Its Tier 2
stubs, route-prefixed i18n and `AM_ENABLED` flag come with it.

[!] **The URL of that repository is not recorded in any document available here.**
It is the one input this step needs and the one thing that cannot be guessed.

## The two rules that differ from every other workstream

> **1. Its CSP keeps the nonce.** Next.js injects inline bootstrap scripts, so
> `script-src 'self'` alone cannot work. **That is the entire reason the console is Vite
> and not Next.js** - a static SPA needs no inline script and therefore needs no nonce,
> and a nonce that exists is a nonce that can be leaked. Do not "harmonise" the two CSPs.

> **2. It is anonymous. There is no authenticated surface**, with exactly one narrow
> exception: the account-deletion flow of ADU-WEB-01 S6.2, which issues a **ticket, not
> a session** - fifteen minutes, four endpoints, rejected by every other endpoint. A
> ticket any other endpoint accepts is a session, whatever it is called.

## The rest, in brief

- **The storefront is the conversion surface and must stay public**, which makes it
  enumerable. The posture is **prevent enumeration, accept scraping** (ADU-API-01 A4):
  no internal UUID in any public URL - storefronts are `/{handle}`, products
  `/{handle}/{slug}` - no unqualified list endpoint, lookup requires a query, paging is
  capped, and anonymous reads are limited at the Cloudflare edge.
- **Aggressive bot detection works against the product.** Storefronts are meant to be
  indexed; a search engine finding the page is a free version of the page's own job. No
  CAPTCHAs, no JS challenges, no user-agent blocking on storefront routes.
- **The storefront response carries trust level and completed handoff count as page
  content**, not a second call. A second round trip on a slow connection is a page that
  renders without the trust signal.
- **The install prompt appears at the reserve action, never on arrival.**
- **Under 40 KB uncompressed** for the first storefront response, single round trip,
  edge-cached. It is the response standing between a bio-link tap and a conversion.
- May import `@adulis/api-client`, `@adulis/locale`, `@adulis/tokens`, `@adulis/config` -
  and nothing under `apps/`.
```
