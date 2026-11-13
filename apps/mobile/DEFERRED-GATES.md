# Deferred gates -- run when the reference devices arrive

Created by WO-0b (ADU-MOB-WO-01 v1.2 S1.1). Every work order appends the device
half of its gate here BY NAME, with its tier. **Tier 3 does not start until this
file is empty.** A deferred gate that nobody wrote down is a skipped gate, and the
difference between the two is this file.

Each line says what is deferred and WHY it could not run at WO-0b. Blocked-on
codes: **P4** reference devices not ordered (ADU-MOB-01 Q7): a low-end Android,
2 GB, on the oldest supported OS, and the oldest iPhone in support (ADU-MOB-01
B17); **P6** no App Store Connect account for the privacy-manifest test upload;
**P8** WO-0a environment setup not complete on this machine -- no Android SDK or
emulator, no `eas` login, no Maestro, no agent-device, the Expo plugin and MCP not
installed.

## Run at WO-0b, recorded so the environment half has a result

- [x] WO-0a S0a.2 check 1: `node -v` is 22.12 or higher -- 22.19.0 on this machine (7 Sep 2026)
- [x] The pre-commit hook SCRIPT blocks on a planted gate violation (`pnpm precommit` red, then the hook in stdin mode exited 2 on a `git commit` -- see docs/build-status/MOB-WO-0-REPORT.md)
- [x] The `product-invariant-reviewer` BRIEF, run from the repository root against an empty diff, produced a coherent report and seven corrections to itself (register D-377)

## Tier 0

- [ ] Development build installs on the reference Android AND the reference iPhone -- P4, P8 (the EAS login is operator setup)
- [ ] EAS development build completes for BOTH platforms -- P8 (`eas` is not installed and no Expo login exists on this machine)
- [ ] Android download size of the development build, with the six fonts in it, measured against the 30 MB budget (ADU-MOB-03 D3/Q3, ADU-MOB-01 S13); the six files alone are 2,381,320 bytes (assets/fonts/SOURCES.md) -- P8
- [ ] Placeholder renders wordmark, TikTok, Instagram, a figure and Amharic -- no glyph box -- on the reference Android (D1 can only fail there) AND the reference iPhone -- P4
- [ ] Same, at the largest OS text size, on both -- P4
- [ ] Which Ethiopic face draws the Amharic line on each device: the bundled file or the system's (register D-368) -- P4
- [ ] EMULATOR: the placeholder renders on an Android emulator -- P8 (no Android SDK on this machine; the Jest render test is the CI half)
- [ ] UPLOAD: a throwaway App Store Connect upload passes the privacy-manifest check -- P6
- [ ] WO-0a S0a.2 check 2: agent-device drives an Android emulator from Windows -- P8
- [ ] WO-0a S0a.2 check 3: `/mcp` shows Expo authenticated, exactly one registration -- P8 (the Expo plugin is not installed)
- [ ] WO-0a S0a.2 check 4: `/context` from `apps/mobile` loads the root file and this workstream's and no sibling's -- run at the start of the next session begun in `apps/mobile`
- [ ] WO-0a S0a.2 check 5: `/permissions` shows the deny rules of `apps/mobile/.claude/settings.json` resolved -- same session
- [ ] Configuration half: `product-invariant-reviewer` invoked as a NAMED subagent from a session started in `apps/mobile` produces a coherent report against an empty diff -- the named-agent discovery is what a session started here proves
- [ ] Configuration half: the pre-commit hook blocks a `git commit` typed inside a Claude session started in `apps/mobile`, through BOTH the Bash and the PowerShell tool, when a gate fails -- the wiring through `.claude/settings.json` is what a session started here proves

## Tier 1

- [ ] Blocking screen at a raised floor, both devices, largest OS text size
- [ ] Blocking screen in am, no glyph box
- [ ] Bootstrap-failure screen renders and does not proceed
- [ ] Clock offset stable across two bootstraps on a device with a wrong timezone

## Tier 2

- [ ] Device id survives a reinstall-free OS update
- [ ] Biometric unlock gates the stored token
- [ ] SMS autofill works with the production message template
- [ ] Full sign-in flow at the largest OS text size, in Amharic
- [ ] App container holds no token, phone number or OTP after the flow
