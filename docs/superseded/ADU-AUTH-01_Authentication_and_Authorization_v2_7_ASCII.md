# ADU-AUTH-01 - Authentication and Authorization

**Version:** 2.7
**Baseline date:** 3 September 2026
**Architecture lifetime:** Six-month market-validation baseline
**Launch scope:** Ethiopia plus explicitly enabled international markets
**Expansion priority:** Ethiopia -> Africa -> Central Asia -> Middle East
**Owner:** Founder / CEO
**Status:** Binding MVP specification for identity, authentication, SMS delivery, sessions, authorization, recovery, and privilege enforcement
**Related:** ADU-DB-01 v1.16  -  ADU-API-01 v1.11  -  ADU-CON-02 v3.2  -  ADU-CON-03 v1.3 - ADU-CON-02 v3.2 - ADU-REPO-01 v1.3 - ADU-API-01 v1.7
**Encoding:** ASCII.

---

# 0. Supersession scope

ADU-AUTH-01 v2.7 supersedes the authentication, session, recovery, operator-authentication, abuse-control, and operational portions of ADU-AUTH-01 v2.5.

The installed v2.5 canonical:

* permission catalogue;
* full 42 x 6 role-permission matrix;
* executable SQL permission seed;

remain binding and unchanged.

```text
AUTHENTICATION / SESSION / RECOVERY / OPERATIONS
-> v2.6

PERMISSION CATALOGUE / ROLE MATRIX / SQL SEED
-> installed v2.5 canonical sections
```

The repository amendment manifest must record this split.

`pnpm verify:permission-doc` remains a mandatory CI gate.

v2.6 does not reconstruct permissions from checksums.

There is no permission-grant change in this revision.

---

# 0.1 What changed in v2.7

**Three sections were wrong, one guarantee was overstated, and one interval was not the interval it claimed.**

| # | Change | S |
|---|---|---|
| **A** | **The new-device payout lock does not fire when a seller has NEVER had payout details** -- and the predicate is *ever had*, not *has an active row* | 20.0a |
| **B** | **The 48-hour guarantee is corrected.** Its notification half depends on a channel that reaches nobody | 20.0b |
| **C** | **`fn_activate_due_payout` gets a job.** Activated only by a screen read, the delay had no upper bound | 20.1 |
| **D** | **Two limiters, distinguished.** The OTP IP limiter is disabled; the bootstrap mint limiter is **platform-scoped by design** | 15 |
| **E** | **The `reason` vocabulary is what shipped** -- `RECOVERY_COOLING`, `NEW_DEVICE`, `NO_TIMING_CONFIG` | 20.0c |
| **F** | **`core.permission.surfaces` is the authority for a surface**, and a gate now compares every catalogue marker to it | 26.4 |

# 0.2 What has landed since v2.6, and what has not

**A specification that does not distinguish what is specified from what is built is one a reader cannot use.**

**Built and proven:** audience bound at challenge creation and rejected in the verify body (S5.2) - `audience` in the one-live-challenge tuple (S5.3) - transport before supersession (S5.5) - the failover classification (S5.6) - the attempt burn surviving rollback (S5.7) - the courier invite claim (S24) - the age declaration and `AGE_DECLARATION_REQUIRED` (S18) - the enumeration invariant across every anonymous path (S17).

**Specified and NOT built:**

| | |
|---|---|
| **The privileged operator factor** (S29.1) | No hardware key, no passkey, no managed identity. **An operator grant today is protected by phone OTP alone** |
| **SMSEthiopia** (S7.1) | Candidate, not a route. `+251` is AfroMessage with `Fallback = NONE` |
| **Every international market** (S9) | None is `ACTIVE`. Ethiopia only |
| **IN_APP as a channel** (S9.3's neighbourhood) | **Nothing writes it.** See S20.0b |

[!] **S29.1 is the one to read twice.** It is the only unbuilt item in this document that protects something already live.

**Everything not listed above is carried forward from v2.6 unaltered.**

---

# 0.2 What changed in v2.6 -- retained for history

| #   | Area                   | Ruling                                                                                         |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| R31 | OTP authority          | Adulis generates and verifies OTP locally                                                      |
| R32 | Ethiopia primary       | AfroMessage is primary +251 SMS transport                                                      |
| R33 | Ethiopia fallback      | SMSEthiopia is the candidate backup; becomes production fallback only after acceptance testing |
| R34 | Ethiopia redundancy    | Backup-provider approval includes sender/compliance readiness and upstream-independence review |
| R35 | International primary  | Infobip is initial primary for enabled non-Ethiopian markets                                   |
| R36 | International fallback | Twilio is fallback where market and provider configuration permit                              |
| R37 | Regional optimization  | Africa's Talking and Unifonic remain deferred                                                  |
| R38 | Market activation      | Technical provider coverage does not automatically enable a country                            |
| R39 | Audience binding       | Audience fixed at challenge creation                                                           |
| R40 | Enumeration            | Authentication behavior never reveals account existence                                        |
| R41 | IP limiter             | Disabled until trusted-proxy topology is configured and tested                                 |
| R42 | SMS-spend protection   | Per-market and global OTP budgets required                                                     |
| R43 | Age declaration        | Rendered to everyone; server requires it only for new account creation                         |
| R44 | Deletion               | D-35 tombstone and `phone_reuse_block` retained                                                |
| R45 | Courier invitation     | Pending matching invite claimed after authentication                                           |
| R46 | Challenge schema       | Separate OTP and step-up challenge models retained                                             |
| R47 | Operators              | Ordinary account + `core.operator_grant` + phishing-resistant privileged factor                |
| R48 | Social accounts        | Verification evidence, not MVP authentication                                                  |
| R49 | Trust                  | Trust-engine calculation remains outside AUTH-01                                               |
| R50 | Permission model       | Existing 42 permissions and 139 grants unchanged                                               |

---

# 1. Architecture objective

Adulis is pre-product-market-fit.

The first six months optimize for:

1. fast implementation;
2. low engineering complexity;
3. low operating cost;
4. acceptable MVP security;
5. reliable Ethiopian authentication;
6. international extensibility;
7. controlled SMS spending;
8. measurable delivery performance;
9. clean migration after validation;
10. preservation of existing authorization boundaries.

The MVP authentication model is:

```text
Phone
  |
Adulis-generated OTP
  |
SMS transport provider
  |
User receives OTP
  |
User submits OTP
  |
Adulis verifies locally
  |
Opaque Adulis session
```

SMS companies transport authentication messages.

They do not become authentication authorities.

---

# PART I - IDENTITY

# 2. Root identity

The permanent Adulis identity is:

```text
core.account.id UUID
```

The phone number is the temporary MVP authentication credential.

It is not the semantic identity of the account.

Conceptually:

```text
core.account
    |
    +-- buyer_profile
    +-- seller
    +-- seller_team_member
    +-- seller_courier
```

During MVP:

```text
core.account.phone_e164
```

may remain:

```text
NOT NULL
UNIQUE
```

because phone OTP remains the ordinary-user authentication mechanism.

## Invariant

Domain ownership always references:

```text
account_id
```

Never:

```text
phone_e164
```

Orders, reservations, claims, reviews, conversations, sellers, sessions, trust events, and related domain objects therefore survive future migration to:

```text
Account UUID
    |
    +-- phone
    +-- passkey
    +-- TikTok
    +-- Instagram
    +-- other credentials
```

---

# 2.1 One account, multiple relationships

One account may simultaneously be:

* buyer;
* Owner of Seller A;
* team member of Seller B;
* courier for Seller C.

Changing mode or relationship does not create another authentication identity.

---

# 2.2 Buyer account creation

Anonymous users may browse, search, view products, and construct a cart.

Authentication begins when durable identity is necessary, normally first reservation.

```text
Browse
  |
Cart
  |
Reserve
  |
Phone
  |
OTP
  |
Account determined / created
  |
Reservation continues
```

Authentication must not be moved to application installation without a separate product ruling.

---

# 2.3 Buyer / Seller mode

Buyer <-> Seller mode switching does not reauthenticate.

Authorization is recalculated against the account's relationships and current seller context.

---

# PART II - ORDINARY AUTHENTICATION

# 3. MVP mechanism

Ordinary users authenticate using:

```text
Phone + SMS OTP
```

Actors:

* buyers;
* sellers;
* seller team members;
* couriers.

Privileged operator functionality has an additional requirement in Section 29.

Deferred for ordinary users:

| Mechanism             | MVP ruling                |
| --------------------- | ------------------------- |
| Password              | Not implemented           |
| Email login           | Not implemented           |
| Social login          | Not Adulis authentication |
| Passkeys              | Deferred                  |
| TOTP                  | Deferred                  |
| Custom biometric auth | Not implemented           |

Device biometrics may locally unlock stored credentials.

Adulis never receives biometric templates.

---

# 4. OTP authority

Adulis owns:

```text
OTP generation
OTP verification
OTP expiry
attempt budget
challenge purpose
challenge audience
session issuance
step-up semantics
```

Transport providers own only:

```text
SMS transport
provider acceptance
delivery status
delivery telemetry
```

Architecture:

```text
                  ADULIS
                     |
               Generate OTP
                     |
          CSPRNG + HMAC verifier
                     |
               SMS ROUTER
                     |
       +-------------+-------------+
       |                           |
   Ethiopia                    International
       |                           |
AfroMessage /                Infobip /
SMSEthiopia                  Twilio
       |                           |
       +-------------+-------------+
                     |
                    SMS
                     |
                   USER
                     |
              submits OTP
                     |
           ADULIS verifies
```

## Invariant

No provider `/verify` endpoint participates in ordinary Adulis authentication.

A provider outage after successful SMS delivery must not stop local verification of a still-valid code.

---

# 4.1 OTP parameters

| Parameter             | Value                             |
| --------------------- | --------------------------------- |
| Length                | 6 digits                          |
| Alphabet              | Numeric                           |
| Generation            | Uniform CSPRNG                    |
| Lifetime              | 5 minutes                         |
| Attempts              | 5                                 |
| Plaintext persistence | Never                             |
| Comparison            | Constant-time                     |
| Resend delay          | 30s -> 60s -> 120s                |
| Live challenge        | One per applicable security tuple |

---

# 4.2 OTP generation

Use a cryptographically secure random-number generator over the complete six-digit space.

Never derive OTP from:

* timestamps;
* sequences;
* phone numbers;
* account IDs;
* weak pseudo-random generators.

---

# 4.3 OTP verifier

Plaintext OTP is never stored.

Retain the installed domain-separated keyed verifier.

Conceptually:

```text
HMAC-SHA-256(
    otp_secret,
    "ADULIS:OTP:v1" ||
    challenge_id ||
    normalized_code
)
```

The key is:

* outside the database;
* outside repository source;
* never exposed to clients.

---

# 4.4 Constant-time comparison

OTP verifier comparison remains constant-time.

Do not replace it with ordinary string equality.

---

# 5. OTP challenge

Retain:

```text
core.otp_challenge
```

Do not merge it with:

```text
core.step_up_challenge
```

during MVP.

The two structures have different security semantics.

---

# 5.1 Challenge context

A sign-in challenge contains at least:

```text
id
phone / phone key
purpose
audience
code verifier
attempt count
status
created_at
expires_at
```

Transport attempts are tracked separately.

---

# 5.2 Audience binding

Request:

```text
POST /v1/auth/otp/request

{
    phone,
    purpose: "SIGN_IN",
    audience: "MOBILE" | "CONSOLE"
}
```

Audience is persisted at challenge creation.

Verification:

```text
POST /v1/auth/otp/verify

{
    challenge_id,
    code,
    device_id,
    age_declared_over_18
}
```

The verification request does not accept `audience`.

## Invariants

```text
MOBILE challenge
-> MOBILE session only
```

```text
CONSOLE challenge
-> CONSOLE session only
```

---

# 5.3 One live challenge

Exactly one live challenge exists for the applicable:

```text
(phone, purpose, audience)
```

tuple.

---

# 5.4 User resend

A user-requested resend:

```text
supersedes current OTP
        |
generates new CSPRNG OTP
        |
creates authoritative replacement
        |
sends new message
```

The old code becomes invalid immediately.

---

# 5.5 Delivery failover is not resend

Delivery failover transports the same existing OTP.

Example:

```text
OTP = 483920
    |
AfroMessage returns DEFINITIVE_NOT_SENT
    |
SMSEthiopia sends 483920
```

There remains:

```text
one challenge
one OTP
one expiry
one attempt budget
```

A user pressing Resend is different:

```text
483920 dies
    |
new OTP generated
```

These operations must never be conflated.

---

# 5.6 Failover classification

Provider adapters classify transport result as at least:

```text
ACCEPTED
DEFINITIVE_NOT_SENT
DELIVERY_UNKNOWN
```

Automatic failover is permitted only from:

```text
DEFINITIVE_NOT_SENT
```

Examples:

* provider explicitly rejects before acceptance;
* provider reports a definitive non-send error;
* account/sender failure is returned before dispatch.

Do not automatically fail over from:

```text
DELIVERY_UNKNOWN
```

Examples:

* HTTP timeout after request transmission;
* response acknowledgement lost;
* delivery receipt delayed;
* provider status temporarily unavailable.

The first provider may already have sent the SMS.

Provider adapters must document which provider-specific responses map to each class.

---

# 5.7 Attempt budget

Five failed OTP submissions kill the challenge.

## Critical invariant

A failed outer request must not restore an attempt already consumed.

Retain D-32 / SR-6 behavior:

```text
wrong OTP
   |
attempt +1 committed
   |
outer transaction fails
   |
attempt remains burned
```

Do not move attempt accounting into a transaction whose rollback restores it.

---

# 5.8 Expiry

Challenge lifetime is five minutes.

Provider state cannot extend OTP validity.

---

# PART III - SMS TRANSPORT

# 6. SMS abstraction

Business/authentication services do not call vendor-specific SDKs directly.

Use:

```text
SmsProvider
```

Conceptually:

```text
interface SmsProvider {
    send(
        phoneE164,
        body,
        deliveryAttemptId
    ) -> SendResult
}
```

Initial implementations:

```text
AfroMessageSmsProvider
SmsEthiopiaSmsProvider
InfobipSmsProvider
TwilioSmsProvider
```

Future only when justified:

```text
AfricasTalkingSmsProvider
UnifonicSmsProvider
```

---

# 6.1 Provider router

Use:

```text
SmsProviderRouter
```

Provider routing comes from market configuration.

Initial architecture:

```text
ETHIOPIA
Primary  = AFROMESSAGE
Fallback = SMSETHIOPIA once approved

INTERNATIONAL ACTIVE MARKETS
Primary  = INFOBIP
Fallback = TWILIO where approved/configured
```

Provider routing has no authorization semantics.

---

# PART IV - ETHIOPIA

# 7. Ethiopian route

Normalized Ethiopian numbers:

```text
+251
```

route initially to:

```text
AFROMESSAGE
```

AfroMessage is the Ethiopian primary SMS transport.

---

# 7.1 Ethiopian backup

Candidate fallback:

```text
SMSETHIOPIA
```

SMSEthiopia does not become production fallback merely because an adapter exists.

Its lifecycle is:

```text
CANDIDATE
   |
ACCEPTANCE_TESTING
   |
APPROVED
   |
PRODUCTION_FALLBACK
```

Until approved:

```text
+251
Primary  = AfroMessage
Fallback = NONE
```

After approval:

```text
+251
Primary  = AfroMessage
Fallback = SMSEthiopia
```

---

# 7.2 SMSEthiopia acceptance requirements

Before `SMSETHIOPIA` becomes production fallback, confirm all of:

1. raw transactional SMS send API is available;
2. API authentication is server-side and suitable for production;
3. provider returns stable message/delivery identifiers;
4. send result can distinguish definitive rejection from uncertain outcome;
5. delivery status or callback is available;
6. retry semantics are documented;
7. Adulis sender configuration is approved where required;
8. pricing is documented;
9. production onboarding/commercial agreement is complete;
10. support/escalation contact exists;
11. test traffic succeeds on relevant Ethiopian networks;
12. p50/p95 delivery latency is measured;
13. duplicate/late delivery behavior is measured;
14. provider availability is monitored.

No production failover until these pass.

---

# 7.3 Upstream-independence review

Different provider companies do not automatically provide independent network paths.

Before treating SMSEthiopia as full redundancy, determine where practical whether:

```text
AfroMessage route
```

and:

```text
SMSEthiopia route
```

depend on the same:

* upstream aggregator;
* SMPP route;
* sender infrastructure;
* carrier integration;
* intermediary dependency.

Classification:

```text
VENDOR_REDUNDANCY_ONLY
```

means the providers protect against:

* provider API outage;
* provider account failure;
* provider billing issue;
* vendor application failure;

but may share the same telecom path.

```text
PARTIALLY_INDEPENDENT_ROUTE
```

or stronger means greater resilience.

The result is recorded in the runbook.

---

# 7.4 Ethiopian outage behavior before fallback approval

Before SMSEthiopia becomes production fallback:

```text
AfroMessage outage
```

does not invalidate already-issued OTPs.

Users who already received a live OTP may continue to authenticate because Adulis verifies locally.

However:

```text
new OTP delivery
new resend delivery
```

may fail until AfroMessage recovers.

This is an explicitly accepted temporary MVP limitation.

---

# 7.5 Ethiopian outage behavior after fallback approval

After SMSEthiopia is approved:

```text
AfroMessage
    |
DEFINITIVE_NOT_SENT
    |
SMSEthiopia
```

may transport the same live OTP.

If AfroMessage result is:

```text
DELIVERY_UNKNOWN
```

no automatic fallback occurs.

A later user-requested resend follows the normal resend flow.

---

# 7.6 Carrier-level residual

Two Ethiopian providers do not guarantee resilience against:

* nationwide carrier outage;
* national telecommunications interruption;
* common upstream carrier failure;
* sender-ID suspension affecting both routes.

Provider redundancy reduces vendor risk.

It does not eliminate national telecom dependency.

---

# PART V - INTERNATIONAL ROUTING

# 8. International primary

For enabled non-Ethiopian markets:

```text
PRIMARY = INFOBIP
```

Initial expansion order:

```text
other African countries
        |
Central Asia
        |
Middle East
```

Provider choice is configuration, not authentication architecture.

---

# 8.1 International fallback

Initial fallback:

```text
TWILIO
```

Twilio may be used only when:

1. market is ACTIVE;
2. Twilio route is explicitly enabled;
3. destination-country requirements have been reviewed;
4. sender requirements are satisfied;
5. provider geographic permissions are enabled;
6. Section 5.6 permits failover.

---

# 8.2 Africa regional optimization

Africa's Talking remains deferred.

It may become primary in selected African markets if measured:

```text
price
delivery success
delivery latency
support
sender approval
```

justify additional integration.

Future example:

```text
KE -> AFRICAS_TALKING
NG -> AFRICAS_TALKING
GH -> AFRICAS_TALKING
```

requires configuration changes, not authentication changes.

---

# 8.3 GCC optimization

Unifonic remains a future optimization candidate for:

```text
Saudi Arabia
United Arab Emirates
Qatar
Kuwait
Bahrain
Oman
```

Only integrate when volume or operational evidence justifies it.

---

# PART VI - MARKET ACTIVATION

# 9. Country allowlist

OTP sending is denied by default for unreviewed international markets.

```text
UNREVIEWED MARKET
-> OTP DISABLED
```

This controls:

* regulatory exposure;
* SMS spending;
* sender requirements;
* fraud;
* launch quality.

---

# 9.1 Market configuration

Maintain configuration similar to:

```text
market_config

market_code

registration_enabled
buyer_registration_enabled
seller_registration_enabled

otp_enabled

sms_primary_provider
sms_fallback_provider

sender_mode
sender_id
sender_registration_status

sms_compliance_status

otp_daily_soft_limit
otp_daily_hard_limit

default_currency
default_timezone
```

---

# 9.2 Market activation state

Recommended values:

```text
UNREVIEWED
COMPLIANCE_REVIEW
SENDER_PENDING
TESTING
ACTIVE
SUSPENDED
BLOCKED
```

Only:

```text
ACTIVE
```

markets may receive ordinary new OTP issuance.

---

# 9.3 Activation checklist

Before ACTIVE:

1. number parsing tested;
2. provider coverage confirmed;
3. sender requirements reviewed;
4. A2P/OTP use allowed;
5. registration completed where needed;
6. template requirements reviewed;
7. provider account approved;
8. price recorded;
9. soft/hard OTP budgets configured;
10. test SMS succeeds;
11. p50/p95 delivery measured;
12. delivery status verified;
13. fallback policy documented;
14. provider geographic controls configured.

Provider marketing coverage alone is insufficient.

---

# 9.4 Market activation ownership

During founder-only MVP, market activation is a privileged founder-run operation.

Maintain a runbook such as:

```text
activate-market.md
```

The runbook records:

* market;
* previous state;
* new state;
* operator/founder;
* timestamp;
* provider;
* sender status;
* compliance status;
* configured budgets;
* test evidence.

Do not build a market-admin dashboard solely for the first six months.

---

# 9.5 Expansion sequence

```text
PHASE 1
Ethiopia

PHASE 2
Selected African countries

PHASE 3
Selected Central Asian countries

PHASE 4
Selected Middle Eastern countries
```

Enable countries individually.

Do not use:

```text
AFRICA = true
```

or:

```text
MIDDLE_EAST = true
```

as registration controls.

---

# 10. Sender identity

SMS sender identity and SMS message body are separate concepts.

```text
SENDER
-> market/provider configuration

MESSAGE BODY
-> Adulis authentication template
```

The body may contain:

```text
Adulis
```

without implying that the sender ID itself is:

```text
Adulis
```

---

# 10.1 Sender modes

Support configuration such as:

```text
ALPHANUMERIC_SENDER
PHONE_NUMBER_SENDER
PROVIDER_MANAGED_SENDER
OTHER_APPROVED_SENDER
```

Never assume one sender form works everywhere.

---

# 10.2 Sender registration

States:

```text
NOT_REQUIRED
PENDING
APPROVED
REJECTED
```

Where sender registration is mandatory:

```text
status != APPROVED
-> otp_enabled = false
```

unless an explicitly approved alternative route exists.

---

# 11. Message template

Default sign-in body:

```text
483920 is your Adulis code.
Expires in 5 minutes.
```

Do not include:

* marketing;
* product details;
* unnecessary links;
* long descriptions.

Step-up:

```text
483920 confirms your Adulis payout change.
Expires in 5 minutes.
```

where provider/template rules permit.

---

# 11.1 Localization

OTP digits remain ASCII numeric.

Message body may be localized.

Every localized template must be measured for:

* SMS encoding;
* segment count;
* cost;
* carrier acceptance.

English ASCII remains fallback.

---

# PART VII - DELIVERY ATTEMPTS

# 12. Transport state is separate from security state

One OTP challenge may have multiple delivery attempts.

Example:

```text
OTP CHALLENGE
    |
    +-- Attempt 1: AfroMessage
    |
    +-- Attempt 2: SMSEthiopia
```

or:

```text
OTP CHALLENGE
    |
    +-- Attempt 1: Infobip
    |
    +-- Attempt 2: Twilio
```

OTP security state remains in:

```text
core.otp_challenge
```

---

# 12.1 Delivery persistence

Preferred model:

```text
core.otp_delivery_attempt
```

Conceptual fields:

```text
id
otp_challenge_id
attempt_no
provider
provider_message_id nullable
status
failure_class nullable
created_at
accepted_at nullable
finalized_at nullable
```

Constraint:

```text
UNIQUE(otp_challenge_id, attempt_no)
```

No OTP plaintext is stored.

---

# 12.2 Delivery status values

At minimum:

```text
PENDING
ACCEPTED
DELIVERED
DEFINITIVE_NOT_SENT
DELIVERY_UNKNOWN
FAILED_FINAL
```

Security code validity is not derived from these statuses.

---

# 12.3 Database dependency

The next DB revision must account for v2.6 requirements including:

* OTP audience binding if not already present;
* `core.otp_delivery_attempt`;
* provider/failure classifications;
* market configuration additions;
* OTP budget configuration;
* event-definition additions;
* indexes/checks;
* generated appendix/manifest updates.

No auth-related schema mutation bypasses the normal DB migration process.

---

# 13. Delivery callbacks

Callbacks update transport state only.

They may indicate:

```text
ACCEPTED
DELIVERED
FAILED
UNKNOWN
```

They never:

* authenticate;
* satisfy OTP;
* mint session;
* consume step-up;
* recover account.

---

# PART VIII - SMS ABUSE AND COST

# 14. PHONE_KEY control

Minimum:

```text
OTP request:
3/hour/PHONE_KEY
```

Resend:

```text
3/15 minutes/PHONE_KEY
```

OTP verification:

```text
5/challenge
```

---

# 14.1 PHONE_KEY

Use:

```text
PHONE_KEY =
HMAC(
    rate_limit_secret,
    normalized_e164
)
```

rather than raw phone as the rate-limit identifier.

---

# 15. IP limiter

**Two limiters, and v2.6 described only one.**

**The OTP IP limiter** -- the intended future control:

```text
10/hour/IP_KEY
```

is:

```text
DISABLED
```

until trusted-proxy configuration is proven.

It is not merely "non-authoritative."

It must not execute in a topology where every request may appear to originate from the same proxy.

## The bootstrap mint limiter is a different control

**`GET /v1/bootstrap` mints a device row for a browser that presents no cookie, and that is an unauthenticated write.** Both obvious options are wrong: **keep it IP-keyed and behind a proxy a first-time visitor gets 429 instead of the whole client configuration; remove it and minting is unbounded at roughly 230 rows per second.**

> **RULING -- it is PLATFORM-SCOPED deliberately, at a ceiling sized for the platform rather than for one caller.** If it collapses to one subject behind a proxy, **it should collapse there on purpose** -- then it bounds the write amplification honestly and stops lying about what it counts.

**Set the ceiling far above any plausible beta hour.** A flood is orders of magnitude, not a multiple. **When S15.1's trusted-proxy work lands it becomes per-IP at the intended ceiling** -- one configuration change, not a redesign.

**This is the second platform-scoped control**, beside `platform_otp_budget`. The shape now has two members.

---

# 15.1 Trusted proxy requirements

Before enabling IP limiting, document/test:

* CDN;
* load balancer;
* reverse proxy;
* trusted hops;
* forwarding header;
* framework proxy configuration;
* spoofed header behavior.

Do not blindly trust client-provided:

```text
X-Forwarded-For
Forwarded
X-Real-IP
```

---

# 16. OTP spending circuit breaker

Every ACTIVE market has:

```text
otp_daily_soft_limit
otp_daily_hard_limit
```

Adulis also has:

```text
otp_global_daily_soft_limit
otp_global_daily_hard_limit
```

---

# 16.1 Soft limit

Crossing soft limit:

```text
alert founders
increase monitoring
service continues
```

---

# 16.2 Hard limit

Hard limit blocks or heavily throttles:

```text
new anonymous OTP issuance
```

It does not:

* invalidate existing OTP;
* log out users;
* stop already-issued code verification.

Authenticated high-security flows such as step-up may use a separately reserved budget.

Founder override is:

* explicit;
* logged;
* temporary where practical.

---

# 16.3 Provider geographic permissions

Provider-side country controls should mirror active Adulis markets where available.

Adulis's own market allowlist remains authoritative.

---

# 17. Enumeration invariant

Unauthenticated authentication behavior must never disclose whether a phone belongs to an Adulis account.

Applies to:

```text
OTP request
resend
verify
rate-limit behavior
```

There is no:

```text
where practical
```

exception.

Market availability may be disclosed if it depends solely on public market configuration.

---

# PART IX - AGE DECLARATION

# 18. Age declaration

Where required:

```text
age_declared_over_18
age_declared_at
```

are stored.

This is self-declaration, not age verification.

---

# 18.1 Rendering

The declaration is rendered on the OTP confirmation screen for everyone.

The client does not first ask whether the phone belongs to an account.

Example:

```text
Enter your 6-digit code

[ ] I confirm that I am 18 years or older.

Continue
```

---

# 18.2 Server requirement

For existing account:

```text
declaration
-> not required to authenticate again
```

For new account:

```text
age_declared_over_18 != true
-> account creation fails
```

Machine-readable failure:

```text
AGE_DECLARATION_REQUIRED
```

Do not return only:

```text
VALIDATION_FAILED
```

or:

```text
The request is not valid.
```

The client must know which input requires correction.

---

# PART X - SESSIONS

# 19. Session model

Sessions remain:

```text
opaque
stateful
immediately revocable
```

No JWT migration is required.

---

# 19.1 Lifetimes

| Audience             | Absolute |       Idle | Concurrent |
| -------------------- | -------: | ---------: | ---------: |
| MOBILE               |  30 days |       none |          5 |
| CONSOLE remembered   |   7 days |    8 hours |          3 |
| CONSOLE unremembered | 12 hours | 30 minutes |          3 |

Mobile 30 days is absolute.

---

# 19.2 Mobile credential

```text
Authorization: Bearer <opaque-token>
```

stored using secure native credential storage.

---

# 19.3 Console credential

```text
__Host-adulis_session
```

with:

```text
HttpOnly
Secure
SameSite=Strict
Path=/
no Domain
```

HttpOnly protects the secret from direct JavaScript extraction.

It does not make XSS harmless.

ADU-SEC-01 retains ownership of browser security controls.

---

# 19.4 Remembered device

```text
__Host-adulis_device
```

selects remembered-device lifetime.

It cannot authenticate alone.

---

# 19.5 Revocation

Revocation is server-side.

Recovery revokes all sessions.

Suspension independently blocks permission.

---

# PART XI - SELLER TAKEOVER PROTECTION

# 20. New-device sign-in

A seller relationship authenticated from an unknown device triggers:

1. security event;
2. push notification where available;
3. security SMS;
4. payout lock.

Default:

```text
new_device_payout_lock = 24 hours
```

---

# 20.0a The lock does not fire on a first set -- and the predicate is *ever had*

**A seller who has never had payout details has nothing to redirect.** The lock exists to stop an attacker sending payments elsewhere after a takeover; **on a brand-new account there is no elsewhere.**

**v2.6 stated the lock unconditionally, and it blocked day-one publishing** -- a seller signing up could not set the account their buyers would pay into.

## The predicate, and the attack that decides it

> **INVARIANT -- the carve-out applies where the seller has NEVER had payout details, in any state. Not where no ACTIVE row exists.**

**The ACTIVE-only reading is breakable in one free move**, and it was drafted that way first:

```text
attacker on an unseen device
      |
fn_cancel_payout_change  -- no step-up, no lock check, deliberately
      |
seller's legitimate pending first set is gone
      |
no ACTIVE row, no PENDING row
      |
state is indistinguishable from a brand-new seller's
      |
attacker sets their own account, unlocked
```

**`fn_cancel_payout_change` requiring no step-up is correct** -- *reverting must always be easier than changing* -- **and it is exactly what manufactures the state the carve-out keys on.**

> **The lesson is the question that was not asked: is this state reachable by a move an attacker can make?** A carve-out is safe only while the condition it tests is unreachable, **and nobody had checked whether it was.**

**A CANCELLED row is still a row.** *Has this seller ever had payout details* is the one thing an attacker-controlled move cannot walk back.

[!] **And one-pending-per-seller is evaluated ABOVE the new-device guard.** A seller with a change in flight is told that, rather than told about a device -- **the true answer, and the more useful one.**

---

# 20.0b The 48-hour guarantee, corrected

**v2.5 sold this as *"an attacker needs 48 hours under a push notification the real seller has already received."*** **Both halves are now less than that says.**

**The interval.** For a first set it is **24 hours** -- the activation delay alone. That is S20.0a's deliberate cost.

**The notification.** [!] **Push reaches nobody.** No mobile app exists and the console does not implement web push, so **a real push adapter would deliver to zero devices.** The fake answered `DELIVERED` and marked rows `SENT` while nothing left the process.

> **The guarantee was already less than it claimed before the carve-out touched it.** The carve-out made a second part untrue; **the notification half was never true.**

**What actually reaches a seller on a new-device sign-in is the security SMS**, which is real and does send. **That is the guarantee: 24 or 48 hours under an SMS.**

**And `IN_APP` has no writer.** The enum value exists, S9.3's fallback names it, **and nothing in the tree produces a row on that channel.** Four producers -- the morning reminder, the stock nudge, the trial warning and **`notification.chat.escalated`** -- have no SMS twin and therefore no delivery at all.

[!] **`notification.chat.escalated` is the one that costs money.** A buyer asks what the assistant cannot answer, it escalates, **and the seller never learns.** That is a lost sale with no trace.

**An `IN_APP` producer needs no vendor and no credentials.** It is owed.

---

# 20.0c The lock's `reason` vocabulary

**Three values, and they are what shipped rather than what v2.6 printed:**

```text
RECOVERY_COOLING
NEW_DEVICE
NO_TIMING_CONFIG
```

**`RECOVERY_COOLING`, not `RECOVERY`** -- the shipped name is the more precise one, because **it names the cooling period rather than the event that started it**, and a lock is about the period.

**`NO_TIMING_CONFIG` is the fail-closed reason and it was unnamed.** [!] **An unnamed reason renders as nothing**, and a seller whose payout is locked for a reason the screen cannot name is a support ticket nobody can answer.

---

# 20.1 Payout activation

New-device payout lock and normal payout activation delay stack.

> **v2.7 -- `fn_activate_due_payout` gets a JOB, and until now the delay had no upper bound.**
>
> It is called from **exactly one place in the product: the `GET` on `/v1/seller/payout`.** No job calls it. **A due `PENDING` stays `PENDING`, and stays cancellable, until somebody opens the payout screen** -- so the exposure is not twenty-four hours, it is **until the seller next looks.**

**The lazy path stays** -- it costs nothing and makes the screen correct at the moment it is read. **The job is what makes the interval mean twenty-four hours.**

[!] **Two requirements on the job, and the second is D-74's lesson paid twice.**

**Per-payout containment.** A raise on one seller's activation must not halt the sweep -- **the ownership-transfer activation had no containment and would have fronted `ORDER BY` and stopped platform-wide.**

**Its own transaction, never lazily inside a handler's.** D-74 exactly: the ownership activation ran at the top of a seller-scoped transaction, the handler then failed, **and the rollback took the activation with it.** [!] **`fn_activate_due_payout` has the same shape on the `GET` path today** -- establish whether a failing payout read rolls back an activation it just performed. **If so it is D-74's twin and has been there since 0022.**

---

# 20.2 Existing orders

Payout change does not rewrite payment instructions already snapshotted to existing orders.

---

# 20.3 SIM-swap residual

SMS OTP remains vulnerable to:

* SIM swap;
* number porting;
* SMS interception;
* telecom social engineering.

Accepted six-month risk.

Passkeys remain the expected long-term direction.

---

# PART XII - STEP-UP

# 21. Step-up model

Retain:

```text
core.step_up_challenge
```

and the installed atomic `fn_assert_step_up` design.

---

# 21.1 Canonical eight

Exactly eight permissions require step-up:

```text
seller.payout:update
seller.orders:reissue_instructions
seller.staff:admin
seller.subscription:update
seller.account:delete
seller.sessions:revoke_all
seller.identity:manage
seller.ownership:transfer
```

All eight are:

```text
CONSOLE only
```

---

# 21.2 Binding

Step-up binds:

```text
authenticated account
action
target_ref
```

---

# 21.3 Properties

| Property          | Requirement               |
| ----------------- | ------------------------- |
| OTP validity      | 5 minutes                 |
| Step-up freshness | 5 minutes                 |
| Uses              | exactly one               |
| Surface           | CONSOLE                   |
| Binding           | account + action + target |
| Consumption       | atomic                    |

---

# 21.4 Atomic consumption

Concurrent reuse must fail.

Rollback must not resurrect a consumed challenge.

Retain installed D-32 behavior.

---

# 21.5 Future factor

Social login must never become the step-up factor for sensitive operations.

Expected future replacement:

```text
WebAuthn / passkey
```

---

# PART XIII - RECOVERY

# 22. Recovery paths

| Situation                    | Path             |
| ---------------------------- | ---------------- |
| New device, same number      | normal OTP       |
| Lost device, number retained | normal OTP       |
| Number/SIM lost              | manual recovery  |
| Number changed               | manual recovery  |
| Conflicting evidence         | escalated review |

---

# 22.1 Recovery evidence

May include:

* prior identity evidence;
* verified social-account control;
* known devices;
* historical orders;
* payout history;
* seller/business information;
* prior security events.

---

# 22.2 Social evidence

Social-account control alone cannot automatically recover an established seller.

---

# 22.3 Weak evidence

Insufficient alone:

* name;
* username;
* follower count;
* public posts;
* public product catalogue;
* public storefront information.

---

# 22.4 High-risk recovery

Where practical, two reviewers/founders approve cases involving:

* high-value/Trusted seller;
* conflicting evidence;
* suspicious devices;
* recent payout changes;
* suspected takeover.

---

# 22.5 Recovery transaction

Successful recovery atomically:

```text
updates authentication control
+
revokes all sessions
+
records recovery
+
sets payout_locked_until
```

Default:

```text
7 days
```

---

# PART XIV - DELETION

# 23. Deletion credential

Deletion OTP yields a:

```text
deletion ticket
```

not an ordinary session.

Lifetime:

```text
15 minutes
```

Scope:

```text
deletion endpoints only
```

---

# 23.1 Phone tombstone

Retain D-35's installed tombstone convention.

Conceptually:

```text
real phone
-> schema-valid unique +999 tombstone derived from account id
```

The installed transformation is normative.

---

# 23.2 Phone reuse

Retain:

```text
phone_reuse_block
```

Deletion performs:

1. phone tombstoning;
2. reuse-policy enforcement.

---

# PART XV - COURIER INVITES

# 24. Pending invite claim

A courier may be invited before account creation.

After successful authentication of the exact normalized phone:

```text
pending invite
    |
phone proven
    |
account determined / created
    |
invite claimed
    |
seller_courier relationship created
```

---

# 24.1 Rules

Claim requires:

* exact normalized phone match;
* pending state;
* not revoked;
* not expired where applicable.

The client cannot choose another invitation phone.

Claim is idempotent.

Invite claim and relationship creation should be transactional.

---

# PART XVI - SOCIAL SELLER VERIFICATION

# 25. Social accounts

Social identities remain verification evidence, not ordinary authentication.

---

# 25.1 Account-control challenge

Retain:

```text
core.account_control_challenge
```

as fallback.

---

# 25.2 OAuth

OAuth may provide stronger proof of social account control.

It proves control of a provider account.

It does not prove legal identity.

---

# 25.3 Stable identity

Use:

```text
provider
provider_subject_id
```

Never `@username` as durable provider identity.

---

# 25.4 Trust separation

AUTH-01 does not calculate:

```text
NEW
ESTABLISHED
TRUSTED
```

Social identities appear as verification/profile facts.

Trust calculation belongs to:

```text
ADU-TRUST-01
```

or the existing canonical trust specification.

---

# PART XVII - AUTHORIZATION

# 26. Authorization gates

Every protected request evaluates applicable:

1. seller state;
2. standing;
3. role;
4. surface;
5. entitlement;
6. scope.

Authentication proves account control.

It does not authorize business actions.

---

# 26.1 Seller state

State may block capability regardless of role.

Examples:

```text
SAFETY_SUSPENDED
CLOSING
```

---

# 26.2 Standing

Seller-team suspension/revocation is checked during authorization.

Session revocation is secondary.

---

# 26.3 Role

Role capability comes from installed v2.5 canonical permission seed.

Clients never choose role.

---

# 26.4 Surface

**`core.permission.surfaces` is the authority for which surface a permission is reachable from.** Nothing else is.

```text
MOBILE
CONSOLE
```

> **v2.7 -- a marker in a catalogue is a CLAIM about a grant, and nothing compared the two.** ADU-API-01's S12 marked analytics overview one way and migration 0006 granted it the other, **and only a build noticed.**
>
> **A gate compares every catalogue surface marker to `core.permission.surfaces`, in both directions** -- the shape `verify:permission-doc` already uses, which exists because this class was found once before. **The grant governs; the marker is corrected to it.**

All eight step-up permissions remain console-only.

---

# 26.5 Entitlement

Role authorization and commercial/trust entitlement are separate gates.

---

# 26.6 Scope

Object ownership remains enforced by:

* foreign keys;
* composite relationships;
* RLS;
* constrained database functions;
* server-side scope checks.

Cross-tenant failures return 404 where required by installed baseline.

---

# 27. Seller context

Seller context is request context, not mutable session state.

Conceptually:

```text
fn_has_permission(
    authenticated_account_id,
    seller_id,
    permission,
    audience
)
```

The authenticated account derives from the validated session.

The client cannot select it.

---

# 28. Canonical permissions

v2.6 does not alter grants.

Retained:

```text
42 permissions
139 grants
```

Roles:

```text
OWNER
ADMIN
SALES_SUPPORT
INVENTORY
ANALYST
CAMPAIGN_MANAGER
```

Installed v2.5 matrix/SQL seed remains canonical.

Do not rebuild permissions from checksums.

`pnpm verify:permission-doc` remains mandatory.

---

# PART XVIII - OPERATOR ACCESS

# 29. Operator model

Operator remains:

```text
core.account
+
core.operator_grant
```

No parallel permanent operator identity system.

---

# 29.1 Strong factor

Privileged operator functionality requires phishing-resistant authentication.

Founder-beta acceptable solutions include:

* hardware security key;
* WebAuthn/passkey;
* managed identity with equivalent phishing-resistant MFA.

Ordinary buyers/sellers do not require passkeys.

---

# 29.2 No impersonation

Operators never:

```text
log in as seller
log in as buyer
assume seller session
assume buyer session
```

---

# 29.3 Derived role

Operator role derives from actual grants.

No client-supplied role is trusted.

---

# 29.4 Break-glass

No shared master password.

Before non-founder privileged staff are introduced, emergency access must be:

* individual;
* logged;
* revocable;
* time-limited where practical.

---

# PART XIX - EVENTS

# 30. Security/event catalogue

Server-side events include at least:

```text
otp_requested
otp_generated

otp_delivery_attempted
otp_delivery_accepted
otp_delivery_unknown
otp_delivery_failed
otp_delivered

otp_provider_failover_started
otp_provider_failover_completed

otp_superseded
otp_verify_failed
otp_verified

otp_market_soft_limit
otp_market_hard_limit
otp_global_soft_limit
otp_global_hard_limit

session_created
session_revoked
new_device_signin

step_up_requested
step_up_satisfied
step_up_failed

account_recovery_requested
account_recovery_resolved

courier_invite_claimed

social_account_verification_started
social_account_verification_completed

age_declaration_recorded
```

---

# 30.1 Closed event catalogue

`analytics.event_definition` is closed/fail-closed.

Every event newly introduced by v2.6 must be seeded through the next database migration before application code emits it.

At minimum review/seed:

```text
otp_delivery_attempted
otp_delivery_unknown
otp_provider_failover_started
otp_provider_failover_completed
```

plus any other v2.6 event absent from the existing catalogue.

No event name is assumed valid merely because AUTH-01 mentions it.

---

# PART XX - TEST REQUIREMENTS

# 31. OTP security

Test:

* full-space CSPRNG;
* domain-separated keyed verifier;
* no plaintext persistence;
* constant-time comparison;
* five attempts;
* attempt burn survives outer rollback;
* superseded challenge fails;
* expired challenge fails;
* one live security challenge.

---

# 31.1 Audience

Test:

* MOBILE -> MOBILE only;
* CONSOLE -> CONSOLE only;
* verify endpoint cannot override audience.

---

# 31.2 Ethiopian routing

Before SMSEthiopia approval:

```text
+251 -> AfroMessage only
```

After approval:

```text
+251 -> AfroMessage
DEFINITIVE_NOT_SENT -> SMSEthiopia
```

Test:

* AfroMessage ACCEPTED does not invoke backup;
* AfroMessage DELIVERY_UNKNOWN does not invoke backup;
* AfroMessage DEFINITIVE_NOT_SENT may invoke backup;
* same OTP is sent during failover;
* user resend creates a new OTP;
* both providers map responses into documented classifications;
* both routes preserve one local OTP challenge.

---

# 31.3 Ethiopian outage

Test:

* already-delivered OTP remains verifiable when AfroMessage API is down;
* before backup approval, new +251 sends fail safely;
* after backup approval, definitive primary non-send invokes backup;
* carrier-wide failure is not misreported as successful redundancy.

---

# 31.4 International routing

Test:

* ACTIVE international market -> Infobip;
* Twilio fallback only when configured;
* DELIVERY_UNKNOWN does not trigger fallback;
* DEFINITIVE_NOT_SENT may trigger fallback;
* provider callback cannot authenticate;
* user resend generates replacement OTP.

---

# 31.5 Market activation

Before ACTIVE test:

* number parsing;
* provider routing;
* sender status;
* compliance status;
* budgets;
* SMS delivery;
* fallback policy;
* geo permissions.

---

# 31.6 SMS budgets

Test:

* market soft alert;
* global soft alert;
* market hard limit;
* global hard limit;
* already-issued OTP remains valid;
* authenticated reserved budget remains available where configured;
* override is logged.

---

# 31.7 IP limiter

Until proxy tests pass:

```text
IP LIMITER = DISABLED
```

Test before enabling:

* trusted proxy chain;
* spoofed headers;
* untrusted headers;
* multiple clients behind proxy;
* actual production CDN/load balancer.

---

# 31.8 Enumeration

Known and unknown phones must not produce account-membership differences for:

* request;
* resend;
* verify;
* malformed request;
* rate limit;
* provider errors.

Market availability may differ only by market configuration.

---

# 31.9 Sessions

Test:

* 30-day MOBILE absolute expiry;
* remembered console limits;
* unremembered console limits;
* revocation;
* remembered-device cookie cannot authenticate alone;
* recovery revokes all sessions.

---

# 31.10 Step-up

For all eight canonical actions:

* CONSOLE only;
* account-bound;
* action-bound;
* target-bound;
* five-minute freshness;
* single use;
* concurrent replay rejected;
* rollback cannot resurrect consumed challenge.

---

# 31.11 Age

Test:

* checkbox rendered for every OTP confirmation;
* no account-existence query needed for rendering;
* existing account can authenticate without fresh declaration requirement;
* new account requires declaration;
* missing new-account declaration returns:

```text
AGE_DECLARATION_REQUIRED
```

---

# 31.12 Deletion

Test:

* deletion ticket cannot act as session;
* real phone scrubbed;
* D-35 tombstone valid/unique;
* `phone_reuse_block` enforced.

---

# 31.13 Courier invite

Test:

* correct authenticated phone claims invite;
* wrong phone cannot claim;
* expired/revoked invite cannot claim;
* repeated sign-in remains idempotent.

---

# 31.14 Event catalogue

Test:

* every v2.6 event is present in `analytics.event_definition`;
* unknown event still fails closed;
* provider timeout path successfully writes `otp_delivery_unknown`;
* failover path successfully writes failover events.

---

# PART XXI - METRICS

# 32. Delivery/auth metrics

Measure by:

```text
country
provider
purpose
```

at minimum:

```text
OTP request count
provider acceptance
delivery rate
p50 delivery latency
p95 delivery latency
resend rate
verification success
auth conversion

SMS cost
cost per successful authentication
cost per market
cost per provider

provider failure rate
fallback rate
duplicate-message reports

new-device sign-ins
recovery volume
takeover reports

buyer country
seller country
international MAU
```

---

# 32.1 Ethiopian provider comparison

After SMSEthiopia enters testing, compare AfroMessage and SMSEthiopia using:

```text
send acceptance rate
delivery rate
p50 latency
p95 latency
p99 latency
API error rate
delivery-status quality
support responsiveness
price/message
sender approval
network/upstream independence
```

Backup approval depends on measured evidence, not landing-page claims.

---

# PART XXII - DEFERRED WORK

# 33. Not required before validation

Do not block launch on:

```text
ordinary-user passkeys
social-login authentication
automatic account merging
automated recovery
advanced device fingerprinting
ML fraud detection
customer TOTP
password login
email login
enterprise SSO
multi-region auth database
custom KYC engine
automatic least-cost routing
carrier-level routing engine
Africa's Talking integration
Unifonic integration
generalized auth.challenge table
```

---

# 34. Regional optimization after traction

Future routing may become:

```text
ETHIOPIA
-> AfroMessage
-> SMSEthiopia backup

SELECTED AFRICA
-> Africa's Talking / Infobip

CENTRAL ASIA
-> Infobip
-> Twilio fallback

GCC / MIDDLE EAST
-> Infobip / Unifonic
-> measured fallback
```

This remains transport optimization.

No OTP/security redesign required.

---

# PART XXIII - REDESIGN TRIGGERS

# 35. Reassess before Month 6 when material

Signals:

```text
10,000+ MAU
1,000+ active sellers

SMS cost harms unit economics
OTP delivery harms conversion
fallback volume becomes material
international traffic becomes significant

manual recovery becomes expensive

serious SIM-swap/takeover incident

passkey-capable-device data supports migration
social OAuth proves reliable

external funding closes
```

---

# 36. Post-validation target

Likely long-term architecture:

```text
                    ADULIS ACCOUNT
                         UUID
                          |
          +---------------+---------------+
          |               |               |
       Passkey          Social           Phone
       primary          identity         fallback
          |               |               |
          +---------------+---------------+
                          |
                       Session
                          |
                    Authorization
```

Not an MVP commitment.

---

# 37. Final six-month architecture

```text
                              ADULIS USER
                                   |
                              E.164 PHONE
                                   |
                              OTP REQUEST
                                   |
                      ADULIS GENERATES OTP
                                   |
                       CSPRNG + HMAC VERIFIER
                                   |
                     PURPOSE + AUDIENCE BOUND
                                   |
                         MARKET ALLOWLIST
                                   |
                         SMS PROVIDER ROUTER
                                   |
               +-------------------+-------------------+
               |                                       |
            ETHIOPIA                              INTERNATIONAL
               |                                       |
          AFROMESSAGE                               INFOBIP
           PRIMARY                                  PRIMARY
               |                                       |
      DEFINITIVE_NOT_SENT                    DEFINITIVE_NOT_SENT
               |                                       |
         SMSETHIOPIA                                TWILIO
          FALLBACK                                  FALLBACK
        AFTER APPROVAL                         WHERE CONFIGURED
               |                                       |
               +-------------------+-------------------+
                                   |
                                  SMS
                                   |
                                 USER
                                   |
                             ENTERS OTP
                                   |
                       ADULIS VERIFIES LOCALLY
                                   |
                         OPAQUE ADULIS SESSION
                                   |
                  +----------------+----------------+
                  |                                 |
                MOBILE                            CONSOLE
                  |                                 |
                  +----------------+----------------+
                                   |
                            AUTHORIZATION
                                   |
                              Seller state
                                   |
                                Standing
                                   |
                                  Role
                                   |
                                Surface
                                   |
                              Entitlement
                                   |
                                 Scope
                                   |
                               FK / RLS
                                   |
                              DOMAIN DATA
```

---

# 38. Binding launch decisions

## Identity

* `core.account.id` is permanent identity.
* Phone is MVP credential.
* Domain records reference account UUID.

## OTP

* Adulis generates OTP.
* Adulis verifies OTP.
* 6 digits.
* CSPRNG.
* HMAC at rest.
* Constant-time comparison.
* 5-minute expiry.
* 5 attempts.
* attempt budget survives rollback.
* audience fixed at challenge creation.

## Ethiopia

Primary:

```text
AfroMessage
```

Candidate backup:

```text
SMSEthiopia
```

SMSEthiopia becomes production fallback only after:

```text
API acceptance test
+
sender/compliance readiness
+
delivery testing
+
pricing/commercial readiness
+
failure-classification validation
+
upstream-independence review
```

Before approval:

```text
Fallback = NONE
```

After approval:

```text
DEFINITIVE_NOT_SENT
-> same OTP via SMSEthiopia
```

## International

Primary:

```text
Infobip
```

Fallback:

```text
Twilio
```

where market/configuration permit.

## Failover

```text
DEFINITIVE_NOT_SENT
-> fallback may send same OTP
```

```text
DELIVERY_UNKNOWN
-> no automatic fallback
```

```text
USER RESEND
-> old OTP invalid
-> new OTP generated
```

## Spending

* PHONE_KEY limit.
* IP limiter disabled until proxy configuration is proven.
* market daily budget.
* global daily budget.
* active-market allowlist.

## Sessions

* opaque;
* stateful;
* immediately revocable.

## Step-up

* separate `core.step_up_challenge`;
* eight canonical actions;
* console-only;
* account/action/target bound;
* one use;
* atomic consumption.

## Recovery

* lost-number recovery manual;
* social control alone insufficient;
* all sessions revoked;
* seven-day payout cooling.

## Social

* verification evidence;
* not MVP authentication;
* no second trust ladder.

## Authorization

* installed v2.5 permission catalogue/matrix remains canonical;
* 42 permissions;
* 139 grants;
* `verify:permission-doc` remains mandatory;
* RLS/scope boundaries remain.

## Operators

* ordinary account + `core.operator_grant`;
* phishing-resistant privileged factor;
* no impersonation.

---

# 39. MVP principle

> Adulis owns authentication.
>
> SMS providers deliver messages.
>
> AfroMessage is Ethiopia primary.
>
> SMSEthiopia becomes Ethiopia backup only after evidence proves it is suitable.
>
> Infobip is international primary.
>
> Twilio is international resilience.
>
> Delivery failover is not resend.
>
> Unknown delivery is not failed delivery.
>
> Country/provider coverage is not market approval.
>
> Keep authorization strict.
>
> Protect payout changes.
>
> Control SMS spending.
>
> Measure everything.
>
> Do not build the final authentication platform until Adulis proves the market exists.
>
> **And do not sell a guarantee whose second half depends on a channel that reaches nobody.**
