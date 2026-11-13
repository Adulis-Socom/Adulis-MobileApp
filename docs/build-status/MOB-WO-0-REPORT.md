# MOB WO-0 REPORT -- toolchain, tokens, agent configuration and shell

**Order:** ADU-MOB-WO-01 v1.2, WO-0 (WO-0a environment setup; WO-0b toolchain, tokens, agent configuration and shell).
**Written as the work happened, 7-8 September 2026**, on branch `ci/scope-filter-main-push` at `810fb27`; nothing is committed by the agent. Governing: ADU-MOB-01 v1.2, ADU-MOB-03 v1.0, ADU-MOB-05 v1.0 S4.3, ADU-REPO-01 v1.3.
**WO-0b is built and every check that can run on this machine is green. WO-0a was not performed -- it is operator setup and the agent must not install its own tools -- and everything that needs an emulator, a device, an EAS login or an App Store Connect account is in `apps/mobile/DEFERRED-GATES.md` by name.**

---

## The answer first

| | |
|---|---|
| **WO-0a** | **Not done, on purpose.** Plugins, MCP servers and global tools need the founder's authentication and change the machine (WO-01 v1.2 S0 change A). What the machine has: Node 22.19.0 (check 1 passes), pnpm 10.32.1, Git Bash, network. What it lacks: the Expo plugin and MCP, `typescript-language-server`, `agent-device`, Maestro, `eas`, a JDK, the Android SDK and any emulator (D-373: three of those are not in WO-0a's list either) |
| **WO-0b** | **Done.** Expo SDK 57 pinned exact; `@adulis/tokens/native` authored from ADU-MOB-03 S2 with measured contrast; the fourteen gates as a self-testing script in the one gate list; three deterministic hooks; two routing skills and the reviewer brief; the S17.2 tree; six fonts with hashes; the privacy manifest and the third-party inspection; `DEFERRED-GATES.md` |
| **Verified** | typecheck (all seven workspaces), lint, dependency rules and all seven fire probes (R-6 included), the fourteen gates with their self-test, 18 token tests, 16 gate/hook tests, 4 Jest render tests, Prettier, the recursive build including `expo export` (2.7 MB Hermes bundle), `expo config` introspection, the pre-commit gate green on the clean tree and red on a planted violation through both shell tools, an 85-file pending secret scan |
| **Reviewed** | A 57-agent adversarial pass (docs/build-status/reviews/MOB-WO-0-review.md): 18 findings confirmed, one a blocker -- the commit hook gated only the Bash tool -- all fixed before any commit; 6 refuted; 47 minors triaged |
| **Register** | D-365 to D-389: three specification conflicts inside ADU-MOB-01 v1.2, two uninstalled documents, one unruled identifier pair, and the review's findings |

---

## What was built, against WO-0b S0b.2

**The workspace.** `apps/mobile` in ADU-REPO-01's slot, `package.json` with every version exact (expo 57.0.20, react-native 0.86.3, react 19.2.3, expo-router 57.0.19, and the SDK-bundled versions of the peers pnpm would otherwise resolve upward -- D-374). `app.config.ts` with the plugins for expo-router, camera, notifications, secure store, SQLite and updates; no App Links, no bundle identifiers (D-372), no icon, no updates URL -- each absence named with the decision it waits on. `ios.privacyManifests` declares the four required-reason categories; the ten third-party manifests in the dependency tree are listed in `apps/mobile/PRIVACY-MANIFESTS.md` (none declares tracking or a collected data type). `eas.json` with the three S19.1 profiles. `metro.config.js` watches the workspace so the three source packages resolve; `babel.config.js` is the Expo preset alone. `tsconfig.json` extends the shared strict base and then Expo's; no strict flag is relaxed. `expo-env.d.ts` is tracked so `tsc` in CI needs no CLI run. Inter 4.1 and Noto Sans Ethiopic, three static weights each, with SHA-256 per file and vertical metrics read from the files (`assets/fonts/SOURCES.md`). The S17.2 tree as `.gitkeep` directories -- `src/store/`, not `src/offline/`. One route, `app/index.tsx`: the wordmark, TikTok, Instagram, a Latin-digit figure and a line of Amharic from the catalogue, and nothing else. `src/components/Text.tsx` is P1: the Latin family by default, weight by face name, no `includeFontPadding`, no `numberOfLines`. The API client is `@adulis/api-client`; `api:generate` delegates to its generator so there is one client, never two.

**`packages/tokens`.** The ADU-MOB-03 S2 set lives at `src/native/` and is exported as `@adulis/tokens/native`. It is a sub-entry rather than the package root because the console has imported the root for months and `ops/scripts/verify-tokens.mjs` parses that file in place (ADU-MOB-03 F2). Every hue in the native roles is a reference into the web set -- `test/native-derivation.test.mjs` fails the moment a second palette starts -- and `test/native-contrast.test.mjs` measures 4.5:1, 3:1 and 7:1 rather than asserting them; it is what found that the console's lightest text step fails on a raised card (D-369). Line heights derive from the measured Ethiopic content height (1.362 em). The package still imports nothing: dependency-cruiser rule `tokens-import-nothing` (R-6), proven to fire by `verify-deps-fires.sh`.

**The fourteen gates.** `apps/mobile/scripts/gates/run.mjs`, one script, in `ops/scripts/gates.mjs` as `mobile-gates` and in `pnpm verify:mobile-gates`, so it runs on every push whatever changed. `--self-test` plants every gate's violation in a throwaway tree and demands each planted file be caught, then plants the allowed placement and demands silence, before the tree is scanned. Matches are substrings (the review found word boundaries let `sessionToken` and `scanQueue` through -- D-383); gate 9 compares `package.json` to a reviewed manifest that names why each dependency exists and whether it is a processor; gate 7 scans the catalogue keys a MOBILE session renders and carries a one-row override list for the shared key WO-1's mapper must replace (D-367).

**The hooks.** `scripts/hooks/`: `pre-commit-gate.mjs` (PreToolUse on `Bash|PowerShell`; on a `git commit` it runs typecheck, tests, the gates and `secret-scan.mjs --pending` over staged, modified and untracked files, and exits 2 on red), `guard-sensitive-writes.mjs` (PreToolUse on Edit|Write; answers `ask` on env, signing, credential and boundary files, case-insensitively), `post-edit-format.mjs` (PostToolUse; Prettier then ESLint on this workstream's files, never blocking). Commands address the scripts through `"$CLAUDE_PROJECT_DIR"` because a hook runs in the current directory (D-382).

**The agent configuration.** `.claude/settings.json` -- the founder's supplied file, plus Edit denies (Claude Code consults Edit rules for writes, never Write rules -- D-376), plus the hooks, minus the out-of-schema `_why`. `.claude/skills/adulis-routing` routes a question to the document and section and says where a conflict is recorded; it answers nothing. `.claude/skills/adulis-unmechanized-invariants` is ADU-MOB-06 S8's last row -- the ten rulings nothing mechanical checks -- with what a reviewer opens for each. `.claude/agents/product-invariant-reviewer.md` reads the diff, the documents and the contracts and asks one question; it knows the FYP ruling is intentional. Its empty-diff run produced a coherent report and seven corrections to itself, all applied (D-377). `apps/mobile/CLAUDE.md` is the founder's file, byte-identical.

**CI.** No second workflow. The mobile package's `typecheck`, `lint`, `test` and `build` are real scripts and ride the scoped gates; the fourteen gates join the repository-wide list; `.github/workflows/ci.yml` gains only the commented Maestro and EAS stages in the file's own convention.

---

## Verification -- the instrument and what it printed

| Check | Command | Result |
|---|---|---|
| Typecheck, every workspace | `pnpm -r typecheck` | green (config, api, api-client, tokens, locale, mobile, console) |
| Lint | `pnpm lint` | green |
| Dependency rules | `pnpm verify:deps` | no violations, 322 modules |
| The rules fire | `bash ops/scripts/verify-deps-fires.sh` (Git Bash) | 7 of 7 probes, including `R-6: packages/tokens -> a dependency caught by tokens-import-nothing` |
| The fourteen gates | `pnpm verify:mobile-gates` | 14 self-tests fire on every planted file and stay silent on the allowed placement; 14 pass against the tree |
| Gate and hook logic | `node --test scripts/gates/gates.test.mjs scripts/hooks/hooks.test.mjs` | 16 pass |
| Tokens | `pnpm --filter @adulis/tokens test` | 18 pass (contrast measured, derivation, structure) |
| Placeholder | `pnpm exec jest` | 4 pass |
| Formatting | `pnpm exec prettier --check` over this order's files | clean (the founder's CLAUDE.md is left unformatted on purpose) |
| The tokens comparator | `pnpm verify:tokens` | unchanged, green -- the web set was not touched |
| Build | `pnpm -r build`; `expo export --platform android` | green; 2.7 MB Hermes bundle, 6.1 MB export with assets |
| Config | `expo config --type introspect` | camera string present; no microphone, Face ID or RECORD_AUDIO; `EXUpdatesRuntimeVersion: file:fingerprint` |
| The commit gate, green | `pnpm --filter @adulis/mobile precommit` | all four steps green |
| The commit gate, red | a planted `includeFontPadding: false`, stdin JSON with tool_name `PowerShell` and `git add -A; git commit -m plant` | gate 14 red; hook exit 2 |
| The guard | stdin JSON for `eas.json` / `app/index.tsx` | `permissionDecision: ask` / silent |
| The secret scan | `node scripts/hooks/secret-scan.mjs --pending` | 85 files clean; a planted PEM caught |
| The gate list | `node ops/scripts/gates.mjs --only lint,deps,contract-prefix,error-locale,docs-ascii,tokens,mt-keys,mobile-gates` | 8 of 8 |

Not run here: `pnpm ci:local` in full (it needs a database and the object store); `verify:deps-fires` through `pnpm` from PowerShell (that shell resolves `bash` to WSL's launcher -- run it from Git Bash or CI).

---

## What was NOT done, and why

- **WO-0a**, entirely: operator setup (S0 change A). Recorded per check in `DEFERRED-GATES.md`; D-373 names the three tools WO-0a's own list omits.
- **The emulator, device, EAS and upload halves** of every tier 0 gate (P4, P6, P8), and the D3 bundle measurement that needs the EAS build. `DEFERRED-GATES.md`, by name, with the blocking code.
- **The session-started-in-apps/mobile proofs**: `/context`, `/permissions`, the named subagent, the hook wiring through the harness. The guard rails were proven by direct invocation instead (D-388).
- **Installing the ADU-MOB documents under `docs/`** (D-371) and the Engineering Manual (D-370). Both are governance PRs under the ASCII gate, outside this order's touched set; until then the routing skill answers MISSING_SOURCE and the reviewer says what it could not check.
- **Splitting the landing into two PRs** (D-378). The tree is uncommitted; the recommendation is below.
- **The two lint rules of ADU-MOB-03 S8** (D4 height on a Text container, D10 `numberOfLines`) and the three cheap lint rules of ADU-MOB-06 S14 Q2 -- owed, not this slice's.
- **Anything in S0b.3**: no screen beyond the placeholder, no network call, no secure storage use, no SQLite table, no camera use, no push registration, no `AGENTS.md`, no `docs/adr/`, no `fyp-ranking-reviewer`, no global tool or MCP.

---

## The readings taken, each recorded

ADU-MOB-00 S2.2 RULE 2: record before choosing. Four places the documents disagreed with themselves or left a term undefined, all in the register with both quotations: gate 10's `expo-sqlite` against B6/S9.5/S17.2 (D-365, D-380); gate 11's `audience` against S4.3 and its directory against S17.2 (D-366, D-379); gate 7's undefined "mobile keys" and the shared `plan` string (D-367); gate 12's console scope and the comment rule (D-381). Two deviations from a document's literal value, with the measurement that forced each: `text.disabled` is neutral[600] because neutral[500] measures 4.41:1 on the raised surface (D-369); `runtimeVersion` is the fingerprint policy because the app-version policy would deliver no update (D-384). One question no document could settle and only a device can: whether the bundled Ethiopic files are ever drawn (D-368).

## Rulings owed

| | Owed by |
|---|---|
| The iOS bundle identifier and the Android package name (D-372) | founder, before the first EAS build |
| One PR or two for the packages half (D-378) | founder |
| ADU-MOB-01 v1.3: S18.1 rows 7, 10, 11, 12 and 14 stated as the scripts read them; the tier-6 grep and S25 corrected with row 10; S17.2 or row 11 naming the same auth directory; S6.2 saying which Expo value carries which of B7's two versions (D-365, D-366, D-367, D-379, D-380, D-381, D-384) | document reissue |
| ADU-MOB-03 v1.1: D3's Ethiopic files after the device measurement (D-368); the console's contrast re-measure under Q5 (D-369) | document reissue |
| WO-01 v1.3: the Android SDK, a JDK and eas-cli in S0a.1 (D-373); S0b.6's scope box; S1.3's "one module" as a directory (D-379) | document reissue |
| Install the ADU-MOB series and the Engineering Manual under `docs/` (D-370, D-371); the founder's CLAUDE.md pointers (D-386) | governance PR |

---

## How to land it

1. Delete or ignore `docs/build-status/permission-probe.txt` (D-389; it predates this order).
2. `git switch -c mobile/wo-0b` -- the current branch carries an unrelated CI commit; the working tree moves with the switch.
3. PR 1 (packages and the gate list): `packages/tokens/**`, `packages/config/eslint.config.js`, `package.json`, `pnpm-lock.yaml`, `ops/scripts/gates.mjs`, `ops/scripts/verify-deps-fires.sh`, `.dependency-cruiser.cjs`, `.gitignore`, `.github/workflows/ci.yml`. It is green on its own: the `mobile-gates` gate passes with an empty `apps/mobile` because every gate's roots may be absent.
4. PR 2 (the app): `apps/mobile/**`, `docs/build-status/DEFECT-REGISTER.md`, `docs/build-status/reviews/MOB-WO-0-review.md`, this report.
5. Name in each PR every new dependency and whether it is a processor -- `apps/mobile/scripts/gates/allowed-dependencies.json` is that list, and gate 9 keeps it honest.
6. Start the next session from `apps/mobile`, run `/context` and `/permissions`, and tick the four session lines in `DEFERRED-GATES.md` before WO-1.

---

## Appendix -- the privacy-manifest inspection

`apps/mobile/PRIVACY-MANIFESTS.md` was generated by this script (run with `node <script> apps/mobile`); rerun it after any dependency change.

```js
const { readdirSync, readFileSync, writeFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
const store = path.join(root, '..', '..', 'node_modules', '.pnpm');
const found = [];
(function walk(dir, depth) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (depth < 9) walk(p, depth + 1); }
    else if (e.name === 'PrivacyInfo.xcprivacy') found.push(p);
  }
})(store, 0);
const rows = []; const seen = new Set();
for (const f of found) {
  let d = path.dirname(f);
  while (!existsSync(path.join(d, 'package.json'))) { const up = path.dirname(d); if (up === d) { d = null; break; } d = up; }
  if (!d) continue;
  const pkg = JSON.parse(readFileSync(path.join(d, 'package.json'), 'utf8'));
  const rel = path.relative(d, f).split(path.sep).join('/');
  const key = `${pkg.name}@${pkg.version}:${rel}`; if (seen.has(key)) continue; seen.add(key);
  const xml = readFileSync(f, 'utf8');
  rows.push({ name: pkg.name, version: pkg.version, rel,
    types: [...new Set([...xml.matchAll(/NSPrivacyAccessedAPICategory(\w+)/g)].map((m) => m[1]))],
    reasons: [...new Set([...xml.matchAll(/<string>([A-Z0-9]{2,5}\.\d)<\/string>/g)].map((m) => m[1]))],
    tracking: /<key>NSPrivacyTracking<\/key>\s*<(true|false)\/>/.exec(xml)?.[1] ?? 'unstated',
    collected: [...new Set([...xml.matchAll(/NSPrivacyCollectedDataType(?!s<)(\w+)</g)].map((m) => m[1]))] });
}
rows.sort((a, b) => a.name.localeCompare(b.name) || a.rel.localeCompare(b.rel));
// ...then write the table (see apps/mobile/PRIVACY-MANIFESTS.md for the shape)
```

Result at WO-0b: ten manifests -- react-native 0.86.3 (six, across React, cxxreact, timing, boost, glog and RCT-Folly), expo-application, expo-constants, expo-file-system and expo-notifications -- declaring FileTimestamp (7), UserDefaults (3), SystemBootTime (2) and DiskSpace (1); every one `NSPrivacyTracking: false`; none declares a collected data type.

---

*Report, MOB WO-0. The work order asked for guard rails before there is anything to guard, and the useful thing this order learned is that guard rails need guarding too: the adversarial pass found the commit hook watching the wrong shell tool, three gates that matched words where the code writes identifiers, a secret scan reading an index that had not been filled yet, and a runtime-version policy that would have delivered no update to anyone -- every one of them green on its own test. They are fixed and their fixes are proven by the same method, planting the violation and watching the gate go red. What the order could not do is everything that needs a device, an emulator or a login, and the file that lists those by name is the difference between deferred and skipped.*