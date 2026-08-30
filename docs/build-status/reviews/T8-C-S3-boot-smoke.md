# Adversarial pass -- T8-C S3

**Ran against:** the working tree of `tier8/t8c-boot-smoke` before commit.
**Performed by:** the building agent, per WORK ORDER T7 S0.
**Written before** the fixes it prompted.

The premise: this section adds a gate whose whole claim is "the console
boots". A gate is only worth its green, so the pass asked one question in
several forms -- *how could this print PASS over a console that does not
run?*

---

## Found by running it, before the review proper

**`spawnSync` deadlocked the gate against its own server.** The first version
started an HTTP server, then launched the browser with `spawnSync` -- which
blocks the Node event loop. The server could not answer the request the
browser made, the browser waited for a page that would never arrive, and the
gate failed with `ETIMEDOUT`.

The failure direction was safe (red, not green) but the *message* was a lie:
it read as a broken console. Now spawned asynchronously, with the reason
written above the call so it is not reintroduced.

## F1 -- the probe injection can become a no-op in silence

The server injects `<script src="/__smoke.js">` by
`.replace('<head>', ...)`. If `index.html` ever stops carrying a literal
`<head>` -- a different builder, a minifier, an added attribute -- the
replace matches nothing, returns the input unchanged, and the only symptom
is a missing report. The gate would go red claiming the page "never reached
the probe", pointing the reader at the console instead of at the harness.

**Fixed:** the server records that the replace was a no-op and the failure
says so: *"index.html carries no literal `<head>`, so the probe was never
injected. Fix the injection, not the console."*

## F2 -- the entity decoder shadowed the deprecated global `unescape`

Cosmetic, and lint had no opinion. Renamed `decodeEntities`.

## F3 -- the header oversold what a mount proves

`#root` having children means React mounted **something**. An error boundary
rendering "we could not load your console" satisfies it exactly. The probe
also watches for 2.5 seconds on one route, so a later throw, or a throw on a
route this never visits, is invisible.

The gate is still worth having -- T7 Phase 5 shipped a bundle that mounted
nothing at all, and every text-reading gate stayed green over it. But a
comment that oversells a check is how the next reader decides no harness is
needed. **Fixed:** the header now states what it does not prove, and points
at the console harness still owed at C-3.

---

## Checked and found sound

- **Failure directions.** Every way the harness itself can break -- browser
  missing, browser crash, server error, truncated DOM, probe absent, report
  unparseable -- produces a FAIL, never a PASS. There is no path on which a
  console that did not mount yields exit 0.
- **It does not skip.** No browser found is `exit 1` naming every path it
  tried, not a green with a note. Four gates in this repository have now been
  found green over an empty subject (D-121, D-122, D-126, D-132); this one
  was written after those.
- **The CSP is real, and asserted to be real.** The server replays the `/*`
  block of `dist/_headers` verbatim, and fails if that block carries no
  `Content-Security-Policy` -- so a parse that silently yielded `{}` cannot
  quietly test an unprotected page. Measured: the console mounts under the
  full production policy with **zero** violations, which nothing in CI had
  previously established.
- **Path traversal.** `path.resolve(DIST, rel)` plus a `startsWith`
  containment check; `new URL()` has already normalised `..` segments. A
  traversal falls back to `index.html` rather than reading outside `dist`.
- **The break flag cannot ship.** Vite substitutes
  `import.meta.env.VITE_SMOKE_BREAK` at build time, so a normal build drops
  the branch -- and the gate greps every emitted bundle for the string and
  fails if it survives. Verified in both directions: the flag build leaks the
  string and the gate says so; the normal build does not.
- **Proven, not trusted.** Built with `VITE_SMOKE_BREAK=1`, the gate reports
  `#root has 0 children`, `uncaught error: Uncaught Error: VITE_SMOKE_BREAK:
  deliberate module-scope throw`, and the flag leak -- exit 1. Rebuilt
  normally: three PASSes, exit 0.
