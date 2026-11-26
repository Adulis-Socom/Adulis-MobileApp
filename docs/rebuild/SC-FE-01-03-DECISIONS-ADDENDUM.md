# SC-FE-01-03 decisions addendum (Batch 02B, 26 November 2026)

Narrow record of the founder's dispositions of `SC-FE-01-03-PROPOSALS.md` (P-01..P-20), taken from the Batch 02B brief.
It does not promote any fixture contract into an API specification. Working authority, not a signed board approval.

## Approved interface behaviour
| Proposal | Disposition |
|---|---|
| P-07 | Approved: server-authoritative deadlines. The Console asks the server at a deadline and never decides from its own clock. |
| P-10 | Approved: the Seller chooser is always shown after sign-in for the initial MVP. |
| P-11 | Approved to stay as is: Help and Account keep their honest "not set up yet" states until their features are built. |
| P-15 | Approved: the page heading takes focus after client-side navigation. |
| P-19 | Approved in part: the dashboard distinguishes unavailable business activity from an empty result. Where the statement sits stays an implementation detail. |
| P-18 | Revised by the brief: meaningful visible navigation labels are preserved where practical (see 02B report 02, finding on the bottom bar). |
| P-20 | Approved: the top bar is sticky on desktop; narrow layouts keep the non-sticky arrangement. |
| P-14 | Unchanged: a fixture device, no commercial rule. |

## Remain provisional frontend contracts (owning backend work order confirms or replaces)
P-01, P-02, P-03, P-04, P-06, P-08, P-09, P-12, P-13. Fixture durations, capability strings, Seller identifiers and
entitlements are not production rules. No OTP limit may be inferred from a demonstration value.

## Seller admission (P-05)
ONB-01 stays authoritative. Login Kit is the primary intended mechanism where approved and available. The separate
social-control DM verification code is the controlled fallback and is never the authentication OTP. No provider access or
verification is implemented in the frontend.

## Shared changes (P-16, P-17)
The labelled workspace registration, CI, lockfile and locale changes in PR #194 are accepted as a one-time coordinated
integration exception and are not split. Future shared-package and root changes follow the workstream rules.

## Added by Batch 02B (proposals, not approved rules)
| Id | Proposal | Why |
|---|---|---|
| P-21 | The Seller subtree (shell included) is not served from an earlier authorization answer while the answer for the current navigation is pending: a skeleton shows until it arrives. | The shell fetches the notification badge, so keeping it mounted would send a protected request on an outdated grant. A brief skeleton per move is the cost; revisit when real latency is known. |
| P-22 | Readiness: permission (the action's and its destination's) is checked before entitlement; a destination without entitlement shows the action disabled with the reason; an unknown action kind shows nothing. | Brief item B; an entitlement-denied destination must not look like an active action. |
