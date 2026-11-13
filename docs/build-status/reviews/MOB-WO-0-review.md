# Adversarial pass -- MOB WO-0b (ADU-MOB-WO-01 v1.2, tiers 0 toolchain, tokens, agent configuration, shell)

**Ran against:** the working tree on `ci/scope-filter-main-push` at `810fb27` plus the
uncommitted WO-0b delta (every file `git status --porcelain` listed at the time), on
7 September 2026.
**Performed by:** a multi-agent workflow (`wo0b-adversarial-review`, run id
`wf_368fabaf-f73`, 57 agents): nine independent reviewers, one dimension each
(tokens, gates, agent configuration, scaffold, repository governance, silent
conflicts, security, Ge'ez and accessibility, and a line-by-line WO-0b checklist
audit), then every finding rated above `note` sent to two skeptics -- one opening
the cited document, one tracing the cited code -- with the finding surviving only
if neither refuted it. A tenth agent exercised the `product-invariant-reviewer`
brief against an empty diff, which WO-0b's configuration gate requires.
**Written AFTER the fixes it prompted were applied** (docs/build-status/README.md
convention 3): the findings below are quoted as the reviewers wrote them, and each
carries what was done about it. The governing documents were read from
`C:\Users\naods\Documents\Business\Adulis\Documentations\Mobile App Documents\`
because they are not installed under `docs/` (D-371).

The premise: WO-0b's deliverables are guard rails -- fourteen gates, three hooks,
two skills, a reviewer brief and a token set with contrast tests. A guard rail that
does not fire is worse than none, so every reviewer was told to construct the
violation its gate should catch and check whether it did.

---

## Confirmed (18, after refutation)

| # | Sev | Finding | Done |
|---|---|---|---|
| C1/C6 | blocker | The pre-commit hook matched the `Bash` tool only, and the script exited 0 for any other tool name; on this machine the primary shell tool is PowerShell, so a `git commit` typed through it was never gated | FIXED. Matcher `Bash|PowerShell`, `SHELL_TOOLS` in the script; proven with a PowerShell-shaped stdin and a planted D1 violation -> exit 2 (D-382) |
| C2 | major | Gate 2's `\b` boundaries missed `sessionToken`, `authToken`, `accessToken` | FIXED. Substring match, any case (D-383) |
| C3 | major | Gate 10's `\b` boundaries missed `scanQueue`, `handoffOutbox`, `enqueueScan`, `drainPending` | FIXED. Substring match; `queueMicrotask` excluded by name (D-383) |
| C4 | major | Gate 12 matched 6- and 8-digit hex only; `'#fff'` passed | FIXED. 3- and 4-digit forms when quoted (D-383) |
| C5 | major | Gate 7 scanned `mobile.*` keys only, so the `error.*` set the app renders -- including the `plan` string D-367 itself named -- was never scanned; bare `price` in the term list would also have hit legitimate product-price copy | FIXED. Scans `mobile.*`, `common.*`, `error.*`; bare price dropped (ADU-MOB-03 D12); tier names and the Ge'ez birr added; `locale-overrides.json` lists the one shared key WO-1's mapper must replace (D-367) |
| C7 | major | Hook commands were exec-form with cwd-relative paths; a `cd` before the commit turned the blocking hook into a non-blocking error | FIXED. Shell-form through `"$CLAUDE_PROJECT_DIR"` (D-382) |
| C8/C14 | major | The secret scan read the index at PreToolUse time, before `git add -A && git commit` or `git commit -a` had filled it -- zero files scanned | FIXED. `--pending` scans staged, modified and untracked files (D-382) |
| C9 | major | `runtimeVersion: { policy: 'appVersion' }` bound the native-compatibility key to `expo.version`, so B21's per-update version bump would have delivered updates to no installed binary | FIXED. Fingerprint policy; introspect shows `file:fingerprint` (D-384) |
| C10 | major | packages/tokens and packages/config land inside the app change; ADU-REPO-01 S6 says its own PR, never bundled; WO-0b S0b.6 says the opposite | RECORDED as a conflict with a recommended two-PR landing (D-378). Not the agent's to commit |
| C11 | major | Gate 11 was rooted at `src/features/auth`, which S17.2's tree does not contain (auth is `src/session/` and `app/auth/`) | FIXED. Roots widened to all three (D-379) |
| C12 | minor | D-365 covered S18.1 row 10 only; the tier-6 gate and S25 carry the same expo-sqlite contradiction | RECORDED (D-380) |
| C13 | major | D3's font-bundle measurement was satisfied by a proxy (file bytes, export size); the real gate -- the Android download with the fonts in it -- was neither run nor listed as deferred | FIXED. SOURCES.md reworded as an input, the measurement added to DEFERRED-GATES.md tier 0 (P8) |
| C15 | major | The secret scan flagged its own test fixtures -- four literal credentials in hooks.test.mjs -- so the first commit that staged the tests would have been blocked | FIXED. Fixtures assembled at test time; the test asserts its own file is clean; `--pending` over the 85-file delta is clean (D-382) |
| C16 | major | expo-camera and expo-secure-store wrote generic microphone and Face ID purpose strings by default -- ADU-MOB-05 S4.4's "a generic string is a rejection" | FIXED. `microphonePermission: false`, `faceIDPermission: false`; introspect shows the camera string only (D-385) |
| C17 | minor | The token tests depended on Node's default type stripping (>= 22.18) and nothing pinned it | FIXED. `--experimental-strip-types` on the script and `engines.node >= 22.18` in packages/tokens |
| C18 | minor | packages/tokens/README.md line 11 still said `src/index.ts` served React Native | FIXED |

## Refuted (6)

| Finding | Why it did not survive |
|---|---|
| Gate 13 is defeated by `fontFamily: family.ethiopic` (no literal) | ADU-MOB-03 D2 specifies gate 13 as a literal grep for the string; the token-reference form is D2's own rule for a human review, not the gate's job. Recorded as a lint candidate beside ADU-MOB-06 S14 Q2 |
| S0b.5's environment/configuration halves were parked in DEFERRED-GATES.md, which S1.1 reserves for the device half | S1.1 says the device half goes there; it never says only the device half, and the file names what blocks each line |
| The placeholder's centred `View` clips at the largest iOS text size | A device measurement the work order explicitly defers; no document says the placeholder scrolls |
| The gate readings exist only in code comments pointing at records that do not exist | False against the delta: D-365 to D-367 were in the register when the review ran; the report is this order's deliverable |
| Nothing stops apps/mobile importing the web root of `@adulis/tokens` | True as a description; no document forbids it, and the web root holds the same hues. A lint candidate, not a defect |
| The sub-entry shape and the values ADU-MOB-03 did not give are decisions recorded only in comments | The values are derived from the web set by a stated rule and tested; the sub-entry decision is in index.ts, README.md and now D-381 |

## Passed through unverified (47 minor), and what was adopted anyway

The verification pass was capped at 24 findings, ranked by severity; 47 minors went
unverified. They were read, and these were adopted because they were cheap and
right: gate 4 and gate 5 now scan all of `apps/mobile` (the document says
"anywhere"); gate 6's header match is case-insensitive and the undocumented
`src/features/seller` exclusion is gone; gate 10's self-test now plants
expo-sqlite OUTSIDE src/store as well; gate 7's term list carries the tier names
and the Ge'ez birr as a whole word; `codeOnly` is quote-aware and no longer
mistakes a generator method for a comment; the sensitive-write guard is
case-insensitive; `isGitCommit` accepts `git.exe`, a full path and a PowerShell
`;` chain; hook arguments with spaces are quoted for cmd.exe; `*.pem` and
`keystore.properties` join .gitignore, the deny list and the scans; the `preview`
EAS profile is a store internal track, not an ad-hoc APK; the placeholder renders
exactly the five things S0b.2 names (the English line and the hard-coded
accessibility label are gone), its figure is set in the Latin family with Latin
digits forced, and a font-load failure renders as a visible diagnostic; the
S17.2 `app/` route directories exist; the third-party `PrivacyInfo.xcprivacy`
inspection is recorded (apps/mobile/PRIVACY-MANIFESTS.md); the `_why` key is out
of settings.json; the founder's CLAUDE.md pointers (WO-01 v1.1, S11) are recorded
for the founder (D-386, D-387); the stray probe file is recorded (D-389).

Not adopted, with the reason: a `no-restricted-imports` rule on the tokens web
root (no document asks for it; a lint candidate); moving `babel-preset-expo` into
package.json (it resolves through `expo`'s tree by design; the comment says so);
the D4 and D10 lint rules of ADU-MOB-03 S8 (owed, and named in the report as
owed, not built in WO-0b); F-numbers in ADU-MOB-01 S22 for the document-versus-
document conflicts (the register entries name the S22 action; the document is not
this repository's to edit).

## The brief's own test

The `product-invariant-reviewer` brief, run against an empty diff, produced the
report its contract asks for and seven corrections to itself, the sharpest being
that its paraphrase of ADU-MOB-AMD-02 section G listed six of the eight items and
two that were not in it. All seven are applied (D-377). That is the configuration
gate doing what S0b.5 says it is for.

## What the pass did not do

It did not run the emulator, the device, the EAS build or the upload -- none can run
on this machine (DEFERRED-GATES.md). It read the working tree from the repository
root, not from a session started in `apps/mobile`, so the settings file's deny rules
and hooks were exercised by direct invocation rather than by the harness (D-388).