# Rebuild authority addendum -- dev promotion policy (26 November 2026)

Status: founder decision, working authority (not a signed board or legal approval). Narrow: it changes
ONE rule, the INF-02 statement that `dev` is the development integration baseline fed by per-work-order
PRs (root `CLAUDE.md`, `docs/engineering/DEVELOPMENT-BRANCH-POLICY.md`), for the rebuild lineage only.
It does not touch `main`, the November 8 pack, the November 24 register or any other decision.
Identifier: RB26-D01.

## RB26-D01 -- Accepted surface milestones are promoted into dev

Every COMPLETE and ACCEPTED frontend or backend surface milestone is promoted from
`rebuild/2026-11-25` into `dev`. The milestone gates are:

| Gate | Milestone |
|---|---|
| SC-FE-12 | Seller Console frontend |
| SC-BE-08 | Seller Console backend |
| MOB-FE-12 | Mobile frontend |
| MOB-BE-09 | Mobile backend |
| SF-FE-07 | Storefront frontend |
| SF-BE-05 | Storefront backend |
| OP-FE-09 | Operator frontend |
| OP-BE-07 | Operator backend |
| REL-08 | Final release acceptance |

Rules:
1. Intermediate work-order PRs keep integrating into `rebuild/2026-11-25`, never into `dev`.
2. Once a milestone's acceptance gate is satisfied AND reviewed, the promotion PR into `dev` is
   authorised without a second approval solely for the merge. It is still a normal reviewed pull request
   that passes every required check; an individual screen or a green intermediate PR is not a milestone.
3. The first promotion is after SC-FE-12. It replaces the active legacy development tree with the clean
   replacement foundation and the completed Seller Console frontend. Archived code stays in Git history
   and the protected recovery tags; no legacy runtime file is restored to make `dev` resemble the old
   workspace. Procedure: `docs/rebuild/DEV-PROMOTION-PROCEDURE.md`.
4. Never: bypass or temporarily remove mandatory checks, force-push, touch `main`. PR #194 is not promoted.
5. Promotion into `dev` is not launch authorisation, deployment authorisation or permission to alter a
   persistent database.
