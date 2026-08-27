# Adulis Claude Engineering Skills Pack v1.0

Prepared for the current two-developer split:

- **CEO:** back-end, PostgreSQL, infrastructure, API, auth authority, operations.
- **COO/CTO:** front-end, UI/UX, public web, seller PWA, mobile Buyer Mode, Seller Companion.

This pack contains the first eight CEO skills and first eight COO/CTO skills requested, with `adulis-spec-router` shared between both roles. `adulis-api-boundary` is included as an extra shared contract-review skill because ADU-API-01 is the formal boundary between the two developers.

## Included skills

### Shared
1. `adulis-spec-router`
2. `adulis-api-boundary` (extra shared dependency)

### CEO / backend — first 8
1. `adulis-spec-router` (shared)
2. `adulis-db-invariant-engineer`
3. `adulis-migration-engineer`
4. `adulis-api-engineer`
5. `adulis-auth-authz-engineer`
6. `adulis-order-concurrency`
7. `adulis-financial-boundary`
8. `adulis-backend-security-review`

### COO/CTO / frontend — first 8
1. `adulis-spec-router` (shared)
2. `adulis-frontend-orchestrator`
3. `adulis-api-client`
4. `adulis-ui-state-mapper`
5. `adulis-design-system`
6. `adulis-seller-companion`
7. `adulis-i18n-geez`
8. `adulis-accessibility`

## Installation

1. Extract this archive at the **repository root**, so the project contains `.claude/skills/...`.
2. Put the current ADU specification files somewhere inside the repository with their exact filenames, `docs/` per ADU-CON-02 v3.0 §12's repository tree. The skills locate them with `Glob`; they are intentionally not duplicated in this pack.
3. Merge `.claude/reference/CLAUDE_MD_SNIPPET.md` into the root `CLAUDE.md` after reviewing it.
4. Start Claude Code at the repository root. Project skills under `.claude/skills/<name>/SKILL.md` are then available to the project.
5. If `.claude/skills` did not exist when the current Claude Code session started, restart once so the directory watcher sees it.
6. Run `/skills` and confirm the Adulis skills appear.
7. Tool-permission semantics (verified against current Claude Code documentation, Aug 2026): `allowed-tools` **pre-approves** the listed tools so they run without a permission prompt — it is not enforced as a restriction. `disallowed-tools` is the actual boundary. The read-only skills in this pack (`adulis-spec-router`, `adulis-api-boundary`, `adulis-backend-security-review`) therefore rely on `disallowed-tools: Edit Write Bash`; keep that pattern and never treat `allowed-tools` alone as a safety control.
8. This pack standardises on `CLAUDE.md` as the agent instruction file, which is Claude Code's native memory file. ADU-CON-02 v3.0 §14.3 names the same file `AGENTS.md`; the next touch of ADU-CON-02 renames it to `CLAUDE.md` so the two agree. Until then, treat the two names as one file.

Claude Code's current skill format supports project skills at `.claude/skills/<skill-name>/SKILL.md`, YAML frontmatter, `allowed-tools`, automatic invocation from descriptions, and supporting files. This pack deliberately keeps shell commands un-preapproved; destructive or environment-specific commands should still pass your normal permission flow.

## First validation

Run these manually:

```text
/adulis-spec-router Add a Manage Subscription button to Seller Companion.
/adulis-spec-router Implement the 107-table target from ADU-CON-02 v3.0 now.
/adulis-db-invariant-engineer Add seller.has_chatbot for faster reads.
/adulis-api-engineer Return English error text from the API.
/adulis-seller-companion Add Accept Reservation.
/adulis-i18n-geez Put Noto Sans Ethiopic first in the font stack.
```

The expected result is that each skill identifies and blocks the relevant violation rather than trying to be helpful around it.

Every skill directory also includes `EVALS.md` with positive, adversarial, and non-trigger examples.

## Skill evaluation

Anthropic's current Claude Code documentation recommends evaluating and iterating on skills; use the official skill-creator workflow if available in your environment. At minimum:

1. Run every prompt in each `EVALS.md`.
2. Record expected vs actual behavior.
3. Add a regression case whenever a skill permits an invalid Adulis change or blocks a valid one.
4. Test both **should trigger** and **should not trigger** prompts.
5. Re-run after source-document revisions.

## Important version-gap behavior

ADU-CON-02 v3.0 explicitly says several dependent documents still need reissue. This pack therefore **fails closed** when an implementation depends on a newer ruling that is not yet in its governing specification. See `.claude/reference/DOCUMENT_AUTHORITY.md`.

This is intentional. The correct workflow is:

```text
Architecture ruling
  -> governing ADU document reissued
  -> skill/source baseline updated
  -> code changed
```

not:

```text
Architecture ruling
  -> AI guesses how to merge documents
  -> code becomes the unofficial specification
```

## Maintenance

When you issue a new binding ADU revision:

1. update `.claude/reference/DOCUMENT_AUTHORITY.md`;
2. update only skills whose governing rules changed;
3. add evals for the changed rule;
4. run the complete eval matrix;
5. commit the specification revision and skill revision together when practical.

Do not copy hundreds of lines of PRD/DB/API text into SKILL.md. Skills should contain procedures and invariants; the canonical truth remains in the ADU documents.
