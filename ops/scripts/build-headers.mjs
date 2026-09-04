/**
 * build-headers.mjs -- fill the console's security-header origins from the
 * same variables the bundle was built with (T23 Phase 4).
 *
 * WHY THIS EXISTS. `apps/console/public/_headers` carried two example
 * hostnames and a note promising they would be replaced "when DNS is
 * provisioned". That is a second place to configure an origin the build
 * already knows, and the drift is silent in exactly the direction that hurts:
 * a policy naming an API the bundle does not call refuses every fetch BEFORE
 * IT LEAVES THE BROWSER, with no server-side symptom at all. D-164 and D-276
 * are both that failure, found twice, in two harnesses.
 *
 * WHAT IT DOES NOT DO. It does not assemble a policy. Every directive is
 * written in `public/_headers`, in order, reviewable in a diff -- which is
 * what ADU-CON-02 S3.9 requires and why that file is load-bearing. This
 * substitutes two ORIGIN TOKENS and nothing else, and it verifies afterwards
 * that the directive list it wrote is the directive list it read.
 *
 * AN UNSET VARIABLE OMITS ITS ORIGIN, AND THAT IS NOT A PERMISSIVE DEFAULT.
 *
 * The first version exited non-zero on an unset variable, on the NODE_ENV
 * principle that the permissive branch is the one nobody chose. It was wrong
 * here, and the CI build said so within a minute: `pnpm build` runs with
 * neither variable set, because it is a does-it-compile build.
 *
 * The principle survives in a better form. THE INVARIANT IS THAT THE POLICY
 * NAMES EXACTLY THE ORIGINS THE BUILD WAS GIVEN -- and a bundle built without
 * VITE_API_BASE_URL has no API to call at all (apiBase() throws before fetch
 * is reached, which is the very fact boot-smoke's D-138 note rests on). So
 * connect-src 'self' with nothing after it is not a guess about that bundle:
 * it is an exact description of it. The two cannot disagree, which is the
 * whole point of deriving both from one value.
 *
 * A variable that is SET but is not a URL is still a refusal. That is a typo,
 * not an absence.
 *
 * AND THE DEPLOY IS COVERED AT THE RIGHT LAYER. What must not happen is a
 * REAL deploy forgetting these, and that is verify:render-yaml's check that
 * the console service declares every VITE_* variable .env.example names. A
 * deployment mistake belongs to a gate over the blueprint, not to a gate over
 * a compile.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONSOLE = path.resolve(here, '../../apps/console');
const SRC = path.join(CONSOLE, 'public', '_headers');
const DIST = path.join(CONSOLE, 'dist');
const OUT = path.join(DIST, '_headers');

/** Origin only: a source expression is a host, never a host plus a path. */
function originOf(raw, name) {
  try {
    return new URL(raw).origin;
  } catch {
    console.error(`FAIL  ${name} is '${raw}', which is not a URL. It must be an absolute origin.`);
    process.exit(1);
  }
}

/** Set and valid -> the origin. Unset -> '', which drops the token entirely. */
function originOrNothing(name) {
  const v = process.env[name];
  if (!v) {
    console.log(`  NOTE  ${name} is not set, so the policy names no origin for it.`);
    console.log('        That is not a default -- a bundle built without it cannot reach');
    console.log('        that origin either, so the policy and the build still agree.');
    return '';
  }
  return originOf(v, name);
}

const API_ORIGIN = originOrNothing('VITE_API_BASE_URL');
const MEDIA_ORIGIN = originOrNothing('R2_MEDIA_PUBLIC_ORIGIN');

const source = readFileSync(SRC, 'utf8');
const filled = source
  .replaceAll('${API_ORIGIN}', API_ORIGIN)
  .replaceAll('${MEDIA_ORIGIN}', MEDIA_ORIGIN)
  // An omitted origin leaves a double space inside a directive. Harmless to a
  // parser, but the file is read by people and diffed by reviewers.
  .replace(/Content-Security-Policy:[^\n]+/, (line) => line.replace(/ {2,}/g, ' ').replace(/ +;/g, ';'));

/*
 * NO UNRESOLVED PLACEHOLDER REACHES dist. A literal `${...}` in a CSP is not
 * a parse error -- browsers drop the source expression they cannot read and
 * enforce the rest, so the page would ship a policy that is quietly stricter
 * than the one written, and the symptom would be a refused fetch weeks later.
 */
const left = filled.match(/\$\{[A-Z_]+\}/g);
if (left) {
  console.error(`FAIL  unresolved placeholder(s) in _headers: ${[...new Set(left)].join(', ')}`);
  process.exit(1);
}

/*
 * THE POLICY IS THE ONE THAT WAS WRITTEN. Substitution cannot add, drop or
 * reorder a directive, and this asserts that rather than trusting it: same
 * directive names, same order, same count. It is the check that keeps this
 * script a substitution rather than an assembler.
 */
const directives = (text) => {
  const m = /Content-Security-Policy:([^\n]+)/.exec(text);
  if (!m) {
    console.error('FAIL  no Content-Security-Policy in apps/console/public/_headers');
    process.exit(1);
  }
  return m[1]
    .split(';')
    .map((d) => d.trim().split(/\s+/)[0])
    .filter(Boolean);
};
const before = directives(source).join(' ');
const after = directives(filled).join(' ');
if (before !== after) {
  console.error(`FAIL  the directive list changed.\n  written: ${before}\n  built:   ${after}`);
  process.exit(1);
}

if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });
writeFileSync(OUT, filled, 'utf8');
console.log(
  `  PASS  dist/_headers written: api=${API_ORIGIN || '(none)'} media=${MEDIA_ORIGIN || '(none)'}`,
);
console.log(`        ${after.split(' ').length} directives, unchanged from public/_headers`);
