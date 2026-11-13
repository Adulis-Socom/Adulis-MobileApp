#!/usr/bin/env node
/**
 * THE FIFTEEN MOBILE GATES -- ADU-MOB-01 S18.1 (gates 1-11, as corrected by
 * v1.3), ADU-MOB-03 v1.0 S8 (gates 12-14) and ADU-MOB-08 S40/S42 (gate 15),
 * as scripts, from WO-0b's first commit.
 *
 * The block quotation below says "fourteen" and is left exactly as issued: it
 * is a quotation from ADU-MOB-WO-01 v1.2 S0b.4, not a count this file owns.
 *
 *   "All fourteen gates exist as scripts from this commit, including the ones
 *    that trivially pass today -- gate 3 guards a directory that does not exist
 *    yet, gate 10 guards a feature that was deleted, and gate 12 guards a
 *    package with one file. That is the point: each is in place before the
 *    code that would trip it."                    (ADU-MOB-WO-01 v1.2 S0b.4)
 *
 * REPOSITORY-WIDE, NEVER PATH-FILTERED. This script is the gate `mobile-gates`
 * in ops/scripts/gates.mjs, the one list that runs on every push whatever
 * changed: "a gate that only runs when someone touches apps/mobile is a gate
 * that is off on exactly the push that moves a forbidden string into a shared
 * package" (ADU-MOB-01 S18.1). Each gate names the ROOTS it scans; four scan
 * packages/.
 *
 * IT ASSERTS ITS OWN FIRE FIRST. `--self-test` plants every gate's violation in
 * a throwaway tree and demands the gate catch every planted file, then plants
 * the allowed placement and demands silence, BEFORE the real tree is scanned
 * (ADU-MOB-00 S7: "prove a gate fires by planting the violation and watching
 * it go red"). A gate that cannot fail is worse than no gate.
 *
 * MATCHES ARE SUBSTRINGS, NOT WORDS. The documents' checks are greps, and the
 * WO-0b review found that word boundaries let `sessionToken`, `scanQueue` and
 * `handoffOutbox` through gates 2 and 10 -- the exact identifiers a TypeScript
 * author writes. Where a substring would hit a known API (`queueMicrotask`)
 * that one name is excluded by name rather than by weakening the match.
 *
 * FOUR READINGS THIS FILE HAD TO TAKE, recorded in the defect register
 * (D-365, D-366, D-367 and their addenda) rather than taken silently
 * (ADU-MOB-00 S2.2 RULE 2):
 *
 *  gate 7   "packages/locale mobile keys" is defined nowhere. Read here as the
 *           keys a MOBILE session renders: mobile.*, common.* and error.*.
 *           Bare "price" is NOT a forbidden term -- a product price is
 *           legitimate copy (ADU-MOB-03 D12) and error.cart_line.price_changed
 *           is one. An error.* key whose shared string is console language is
 *           listed in locale-overrides.json with the mobile.* key WO-1's mapper
 *           renders instead; the gate skips it and fails if it disappears.
 *  gate 10  RULED IN v1.3 (D-365 + D-380). v1.2 banned expo-sqlite
 *           application-wide in three places while B6 and S9.5 of the SAME
 *           document require exactly one use -- the single-row client-state
 *           store -- which made the specification unsatisfiable. Now three
 *           independent checks: see GATE_10_TEXT, the canonical string.
 *  gate 11  RULED IN v1.3 (D-366; supersedes D-379). v1.2 banned `audience`
 *           directory-wide under src/features/auth, forbidding the thing S4.3
 *           MANDATES -- it is stamped at CHALLENGE creation. The gate is now
 *           anchored at the OTP client module and reads the VERIFY call's body
 *           literal only. A body it cannot analyse is a FAILURE, never silence.
 *  gate 12  "a hex literal anywhere outside packages/tokens" scans apps/mobile
 *           and packages/, not apps/console: the console's reconciliation onto
 *           the token roles is the console's work (ADU-MOB-03 F2, Q5).
 *
 * Markdown is scanned by no gate -- these are rules about code, and a rule
 * quoted in a document is not a violation of itself. This directory is excluded
 * for the same reason: it holds every forbidden pattern as a string. Gates 1,
 * 10, 11 and 14 drop comments before matching and 1 and 14 skip test files,
 * because the primitive that obeys D1 names the property in its own header and
 * the test that asserts its absence names it in the assertion; a gate that
 * fails on the proof of compliance measures the wrong thing. Gates 3, 12 and 13
 * stay literal, as their documents write them.
 *
 * Run: pnpm verify:mobile-gates            (root; self-test, then the tree)
 *      node apps/mobile/scripts/gates/run.mjs --self-test [--root <dir>]
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');

const CODE_EXTS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.svg',
  '.yml',
  '.yaml',
]);
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'android',
  'ios',
  '.expo',
  'coverage',
  '.pnpm',
  'build',
]);
const SELF = /^apps\/mobile\/scripts\/gates\//;
const APP_AND_SRC = ['apps/mobile/app', 'apps/mobile/src'];
const WHOLE_APP = ['apps/mobile'];
const TEST_FILE = /(\.test\.[jt]sx?$|(^|\/)__tests__\/)/;

const toPosix = (p) => p.split(path.sep).join('/');

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name));
    } else if (entry.isFile()) {
      yield path.join(dir, entry.name);
    }
  }
}

/** Every code file under the named roots, as { abs, rel } with a posix rel path. */
export function codeFiles(root, roots) {
  const out = [];
  for (const r of roots) {
    const abs = path.join(root, r);
    if (!existsSync(abs)) continue;
    for (const f of walk(abs)) {
      if (!CODE_EXTS.has(path.extname(f))) continue;
      const rel = toPosix(path.relative(root, f));
      if (SELF.test(rel)) continue;
      out.push({ abs: f, rel });
    }
  }
  return out;
}

/**
 * Drop the comment part of a line so a rule quoted in a comment is not a hit.
 * Quote-aware: a `//` inside a string (a URL) is not a comment. A line that
 * starts with `*` followed by whitespace or nothing is a block-comment line; a
 * generator method (` *gen()`) is not.
 */
export function codeOnly(line) {
  let out = '';
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (quote) {
      out += ch;
      if (ch === '\\') {
        out += next ?? '';
        i += 1;
      } else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '*') {
      const close = line.indexOf('*/', i + 2);
      if (close === -1) return /^\s*$/.test(out) ? '' : out;
      i = close + 1;
      continue;
    }
    if (ch === '/' && next === '/') break;
    out += ch;
  }
  if (/^\s*\*(\s|\/|$)/.test(out)) return '';
  return out;
}

/**
 * Grep the named roots for a pattern. `exclude` are regexes over the posix rel
 * path; `strip` runs codeOnly() first. Patterns must not carry the g flag --
 * RegExp#test is stateful with it.
 */
export function grep(root, { roots, pattern, exclude = [], strip = false }) {
  const hits = [];
  for (const f of codeFiles(root, roots)) {
    if (exclude.some((re) => re.test(f.rel))) continue;
    const lines = readFileSync(f.abs, 'utf8').split(/\r?\n/);
    lines.forEach((raw, i) => {
      const line = strip ? codeOnly(raw) : raw;
      if (pattern.test(line))
        hits.push({ file: f.rel, line: i + 1, text: raw.trim().slice(0, 140) });
    });
  }
  return hits;
}

const EXACT_VERSION = /^(\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?|workspace:\*)$/;
const MANIFEST = 'apps/mobile/scripts/gates/allowed-dependencies.json';
const OVERRIDES = 'apps/mobile/scripts/gates/locale-overrides.json';
const PACKAGE_JSON = 'apps/mobile/package.json';

/** Gate 9: package.json and the reviewed manifest agree, both directions, and every version is exact. */
function checkDependencies(root) {
  const hits = [];
  const pkgPath = path.join(root, PACKAGE_JSON);
  const manPath = path.join(root, MANIFEST);
  if (!existsSync(pkgPath))
    return [{ file: PACKAGE_JSON, line: 0, text: 'apps/mobile/package.json is missing' }];
  if (!existsSync(manPath))
    return [{ file: MANIFEST, line: 0, text: 'the reviewed dependency manifest is missing' }];
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const manifest = JSON.parse(readFileSync(manPath, 'utf8'));
  for (const section of ['dependencies', 'devDependencies']) {
    const declared = pkg[section] ?? {};
    const reviewed = manifest[section] ?? {};
    for (const [name, version] of Object.entries(declared)) {
      if (!(name in reviewed))
        hits.push({
          file: PACKAGE_JSON,
          line: 0,
          text: `${section}.${name} is not in the reviewed manifest (B2: name it, say whether it is a processor)`,
        });
      if (!EXACT_VERSION.test(version))
        hits.push({
          file: PACKAGE_JSON,
          line: 0,
          text: `${section}.${name}@${version} is a range; ADU-MOB-01 S20.4 pins exact`,
        });
    }
    for (const name of Object.keys(reviewed)) {
      if (!(name in declared))
        hits.push({
          file: MANIFEST,
          line: 0,
          text: `${section}.${name} is reviewed but no longer declared -- remove it from the manifest`,
        });
      const entry = reviewed[name];
      if (typeof entry?.why !== 'string' || typeof entry?.processor !== 'boolean') {
        hits.push({
          file: MANIFEST,
          line: 0,
          text: `${section}.${name} needs a 'why' and a boolean 'processor'`,
        });
      }
    }
  }
  return hits;
}

/**
 * Gate 7 (ADU-MOB-01 v1.3, D-367). v1.2 forbade "mobile keys" relating to tiers
 * and defined "mobile keys" nowhere in the corpus. The corrected reading:
 *
 *   SCOPE      the mobile.*, common.* and error.* locale key namespaces
 *              (ADU-MOB-01 S5.1 -- the app renders the server's message_key
 *              from the catalogue). This ratifies the widened reading already
 *              applied here.
 *   FORBIDDEN  case-insensitive: any tier name, upgrade, subscribe, billing,
 *              plan.
 *   PRICE      NOT forbidden on its own -- a product price is legitimate buyer
 *              copy (ADU-MOB-03 D12). `price` fails ONLY in a billing context:
 *              when it co-occurs, in the same key path or the same value, with
 *              one of the five tokens above.
 *
 *   CURRENCY   RATIFIED as part of gate 7 (v1.3). A currency amount hardcoded
 *              in a locale catalogue is ALWAYS wrong regardless of tier
 *              language, because prices come from data at runtime and never
 *              from a translation string. It is a SIBLING rule to the five
 *              tokens, not a subset of them -- `Br. 1,200 per month` fails on
 *              the currency clause alone, with no billing token present.
 *
 * The Ge'ez birr is matched as a whole word (the syllable pair also ends the
 * word for "store", which the catalogue says on every other line).
 */
const BILLING_CI =
  /\b(tier|tiers|upgrade|upgrades|upgrading|subscribe|subscribes|subscribed|subscription|subscriptions|billing|plan|plans)\b/i;
const CURRENCY_CI =
  /\b(ETB|USD|EUR)\b|\bbirr\b|(?<![\u1200-\u135A])\u1265\u122d(?![\u1200-\u135A])|[$\u20ac\u00a3]\s?\d|\bBr\.?\s?\d|per month|\/month\b/i;
const TIER_NAMES_CS = /\bVerified Pro\b|\bPro\b|\bBusiness (tier|plan|subscription)\b/;
const PRICE_CI = /\bpricing\b|\bprices?\b/i;
const MOBILE_PREFIXES = /^(mobile|common|error)\./;
const CATALOGUE_KEY =
  /'((?:mobile|common|error)\.[^']+)'\s*:\s*\r?\n?\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/g;

/** True when `text` carries one of the five billing tokens or a tier name. */
function billingContext(text) {
  return BILLING_CI.test(text) || TIER_NAMES_CS.test(text);
}

/**
 * `key` is the catalogue key path; it participates in the price rule so that
 * `mobile.billing.price` fails on its key alone while `mobile.cart.price` does
 * not. Callers that only have a value may omit it.
 */
export function forbiddenTerm(value, key = '') {
  if (billingContext(value) || CURRENCY_CI.test(value)) return true;
  return PRICE_CI.test(value) && billingContext(`${key} ${value}`);
}

function checkMobileLocale(root) {
  const hits = [];
  const ovPath = path.join(root, OVERRIDES);
  const overrides = existsSync(ovPath)
    ? (JSON.parse(readFileSync(ovPath, 'utf8')).overrides ?? [])
    : [];
  const skip = new Map(overrides.map((o) => [o.key, o]));
  const seenKeys = new Set();
  for (const rel of ['packages/locale/src/en.ts', 'packages/locale/src/am.ts']) {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) continue;
    const src = readFileSync(abs, 'utf8');
    for (const m of src.matchAll(CATALOGUE_KEY)) {
      const key = m[1];
      if (!MOBILE_PREFIXES.test(key)) continue;
      seenKeys.add(key);
      if (skip.has(key)) continue;
      if (forbiddenTerm(m[3], key)) {
        const line = src.slice(0, m.index).split(/\r?\n/).length;
        hits.push({ file: rel, line, text: `${key}: ${m[3].slice(0, 100)}` });
      }
    }
  }
  for (const o of overrides) {
    if (seenKeys.size > 0 && !seenKeys.has(o.key)) {
      hits.push({
        file: OVERRIDES,
        line: 0,
        text: `${o.key} is listed as overridden but no longer exists in the catalogue -- remove the row`,
      });
    }
  }
  return hits;
}

/** Gate 2: AsyncStorage in the same file as a credential-shaped identifier (substring, any case). */
const CREDENTIAL_WORD = /token|session|device_?id/i;

function checkAsyncStorageWithCredential(root) {
  const hits = [];
  for (const f of codeFiles(root, APP_AND_SRC)) {
    const src = readFileSync(f.abs, 'utf8');
    if (/AsyncStorage/.test(src) && CREDENTIAL_WORD.test(src)) {
      hits.push({
        file: f.rel,
        line: 0,
        text: 'AsyncStorage beside a token/session/device id identifier -- secure storage only (ADU-MOB-01 S3.7)',
      });
    }
  }
  return hits;
}

/**
 * Gate 10 (ADU-MOB-01 v1.3, D-365 + D-380). v1.2 banned expo-sqlite
 * application-wide in three places, which contradicted B6 and S9.5 -- those
 * require EXACTLY ONE expo-sqlite use, the single-row client-state store -- and
 * so made the specification unsatisfiable. Three independent checks now, all
 * zero. 10a permits the one legitimate row while still catching a second store;
 * 10b and 10c are what actually enforce "no offline mode", which the expo-sqlite
 * ban had been standing in for and doing badly.
 *
 * GATE_10_TEXT is the canonical string. It appears in three places in
 * ADU-MOB-01 v1.3 -- the S18.1 gate table, the S18 tier-6 gate and the S25
 * release gate -- and they must be identical.
 */
const GATE_10_TEXT =
  '10a expo-sqlite imported outside src/store/ = 0; 10b expo-background-fetch or expo-task-manager anywhere = 0; 10c any outbox/queue/drain/pending-sync identifier anywhere = 0';

/**
 * 10a matches an IMPORT, not a mention: a dependency line in package.json and a
 * plugin string in app.config.ts declare the module without importing it, and
 * both are required for the one legitimate store to work at all.
 */
const SQLITE_IMPORT = /(?:\bfrom|\brequire\s*\(|\bimport\s*\(|^\s*import)\s*['"]expo-sqlite['"]/;
const STORE_DIR = /^apps\/mobile\/src\/store\//;
const BACKGROUND_MODULES = /expo-background-fetch|expo-task-manager/i;
/**
 * 10b also matches the bare identifiers, restored in v1.3: the module strings
 * alone missed a symbol used without the import beside it. None of these has a
 * legitimate use in an online-only app. If one ever collides with an unrelated
 * name, the fix is to RENAME, not to widen the exemption list.
 * `BackgroundFetchResult` is listed separately because `\bBackgroundFetch\b`
 * does not match inside it.
 */
const BACKGROUND_IDENTIFIERS =
  /\b(TaskManager|BackgroundFetchResult|BackgroundFetch|defineTask|registerTaskAsync)\b/i;
const QUEUE_IDENTIFIERS = /outbox|queue|drain|pending[_-]?sync/i;

/**
 * 10c exemptions. An exemption buried inside a pattern is one nobody re-reads;
 * every entry here carries its reason and is reviewed like a dependency.
 */
export const QUEUE_EXEMPTIONS = [
  {
    token: 'queueMicrotask',
    why: 'platform scheduling primitive -- runs within the current tick and persists nothing',
  },
];

/** 10b. The module names and the symbols they export, wherever they appear. */
export function backgroundModule(line) {
  return BACKGROUND_MODULES.test(line) || BACKGROUND_IDENTIFIERS.test(line);
}

/** 10c. Queue identifiers, with the reviewed exemptions removed first. */
export function queueIdentifier(line) {
  const stripped = QUEUE_EXEMPTIONS.reduce((s, e) => s.split(e.token).join(''), line);
  return QUEUE_IDENTIFIERS.test(stripped);
}

function checkNoQueue(root) {
  const hits = [];

  // 10a -- expo-sqlite imported outside src/store/.
  for (const h of grep(root, {
    roots: WHOLE_APP,
    pattern: SQLITE_IMPORT,
    exclude: [STORE_DIR],
    strip: true,
  }))
    hits.push({
      ...h,
      text: `${h.text}  (10a: expo-sqlite may be imported only under src/store/ -- B6, S9.5)`,
    });

  // 10b and 10c -- one walk, two predicates.
  for (const f of codeFiles(root, WHOLE_APP)) {
    const lines = readFileSync(f.abs, 'utf8').split(/\r?\n/);
    lines.forEach((raw, i) => {
      const line = codeOnly(raw);
      const text = raw.trim().slice(0, 140);
      if (backgroundModule(line))
        hits.push({
          file: f.rel,
          line: i + 1,
          text: `${text}  (10b: no background execution -- B25)`,
        });
      if (queueIdentifier(line))
        hits.push({
          file: f.rel,
          line: i + 1,
          text: `${text}  (10c: no outbox/queue/drain/pending-sync identifier -- B25)`,
        });
    });
  }
  return hits;
}

/**
 * Gate 11 (ADU-MOB-01 v1.3, D-366). v1.2 banned `audience` anywhere under
 * src/features/auth/, which forbade the thing S4.3 MANDATES: `audience` is
 * stamped at CHALLENGE creation and travels on the challenge request. What must
 * never carry it is the VERIFY request.
 *
 * The anchor is the OTP client module -- the one file that builds both calls --
 * not a directory. The gate finds the verify path, reads the object literal that
 * follows it, and fails if `audience` is inside. Present on challenge = required;
 * present on verify = fail.
 *
 * A GATE THAT GOES SILENT ON INPUT IT CANNOT ANALYSE IS WORSE THAN NO GATE
 * (v1.3). The body argument must be an object literal AT THE CALL SITE. When it
 * is not -- built elsewhere and passed by name, or the path held in a const --
 * the gate does not shrug and pass. It FAILS and says why, which turns an
 * invisible hole into a build failure. Restructure the call, or amend the gate
 * deliberately; do not let it stay quiet.
 */
const OTP_CHALLENGE_PATH = /\/v1\/auth\/otp\/(request|resend)\b/;
const OTP_VERIFY_PATH = /\/v1\/auth\/otp\/verify\b/;

/** The balanced object literal beginning at the first `{` at or after `from`. */
export function bodyLiteralAfter(src, from) {
  const open = src.indexOf('{', from);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return src.slice(open);
}

export const GATE_11_UNANALYSABLE =
  'gate 11: verify body is not an analysable object literal - the gate cannot check it. Restructure the call or amend the gate.';

/**
 * The verify call's body argument. `literal` is the balanced object literal, or
 * null when the call does not present one at the call site -- which is a gate
 * failure, not a pass. `at` is the index of the verify path, for line reporting.
 */
export function verifyBodyLiteral(src) {
  const m = OTP_VERIFY_PATH.exec(src);
  if (!m) return null;
  const at = m.index;
  let i = at + m[0].length;
  while (i < src.length && !/['"`]/.test(src[i])) i += 1; // to the closing quote
  i += 1;
  const skipWs = () => {
    while (i < src.length && /\s/.test(src[i])) i += 1;
  };
  skipWs();
  if (src[i] !== ',') return { at, literal: null };
  i += 1;
  skipWs();
  if (src[i] !== '{') return { at, literal: null };
  return { at, literal: bodyLiteralAfter(src, i) };
}

function checkAudienceInVerify(root) {
  const hits = [];
  for (const f of codeFiles(root, APP_AND_SRC)) {
    if (TEST_FILE.test(f.rel)) continue;
    const src = readFileSync(f.abs, 'utf8');
    if (!OTP_CHALLENGE_PATH.test(src) || !OTP_VERIFY_PATH.test(src)) continue;
    const found = verifyBodyLiteral(src);
    if (!found) continue;
    const line = src.slice(0, found.at).split(/\r?\n/).length;
    if (found.literal === null) {
      hits.push({ file: f.rel, line, text: GATE_11_UNANALYSABLE });
      continue;
    }
    const code = found.literal.split(/\r?\n/).map(codeOnly).join('\n');
    if (/\baudience\b/.test(code)) {
      hits.push({
        file: f.rel,
        line,
        text: `the OTP verify body carries audience -- S4.3 stamps it on the challenge only: ${found.literal
          .replace(/\s+/g, ' ')
          .slice(0, 100)}`,
      });
    }
  }
  return hits;
}

/**
 * Gate 15 (ADU-MOB-08 S40, S42). Having Playwright installed is not the
 * violation; using it for the NATIVE app is -- S40 lists "Playwright as the
 * primary native-app testing solution" among the tools not to add, and S42
 * records it as NOT PRIMARY. This is enforced mechanically rather than by
 * policy because Maestro is not installed yet, which makes Playwright the only
 * e2e tool present on the machine -- a temptation gradient a written rule will
 * not hold against.
 *
 * An IMPORT, on the same reading as 10a: declaring the dependency is gate 9's
 * job, against the reviewed manifest. `playwright-core` is included because it
 * is the same library under a name the two listed patterns would miss.
 */
const PLAYWRIGHT_IMPORT =
  /(?:\bfrom|\brequire\s*\(|\bimport\s*\(|^\s*import)\s*['"](playwright(-core)?|@playwright\/[^'"]+)['"]/;

/**
 * Gate 12. Six and eight digits anywhere a colour can sit; three and four
 * digits only when quoted, so a private class field (`this.#add`) is not a
 * colour but `'#fff'` is.
 */
const HEX = /(?<![\w#&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})\b|(?<=['"`])#[0-9a-fA-F]{3,4}(?=['"`])/;

export {
  APP_AND_SRC,
  HEX,
  MANIFEST,
  OVERRIDES,
  PACKAGE_JSON,
  SQLITE_IMPORT,
  STORE_DIR,
  TEST_FILE,
  WHOLE_APP,
  checkAsyncStorageWithCredential,
  checkAudienceInVerify,
  checkDependencies,
  checkMobileLocale,
  checkNoQueue,
};

/**
 * The gates. `check(root)` returns hits; `fires` is a fixture the gate MUST
 * catch -- every planted file -- and `silent` a fixture it must NOT, both written
 * into a throwaway tree by the self-test. Fixture paths are repository-relative.
 */
export const GATES = [
  {
    num: 1,
    id: 'fetch-outside-client',
    title: '`fetch(` outside src/api/',
    ruling: 'ADU-MOB-01 B5',
    check: (root) =>
      grep(root, {
        roots: APP_AND_SRC,
        pattern: /\bfetch\s*\(/,
        exclude: [/^apps\/mobile\/src\/api\//, TEST_FILE],
        strip: true,
      }),
    fires: { 'apps/mobile/src/features/cart/load.ts': "export const x = fetch('/v1/cart');\n" },
    silent: {
      'apps/mobile/src/api/client.ts':
        "export const x = fetch('/v1/bootstrap'); // the only fetch\n",
      'apps/mobile/src/lib/note.ts':
        "export const u = 'https://example.test/x'; // fetch( is named only in this comment\n",
    },
  },
  {
    num: 2,
    id: 'asyncstorage-with-credential',
    title: 'AsyncStorage in the same file as token, session or device_id',
    ruling: 'ADU-MOB-01 S3.7, S14.1',
    check: checkAsyncStorageWithCredential,
    fires: {
      'apps/mobile/src/session/store.ts':
        "import AsyncStorage from '@react-native-async-storage/async-storage';\nexport const save = (sessionToken) => AsyncStorage.setItem('k', sessionToken);\n",
    },
    silent: {
      'apps/mobile/src/i18n/prefs.ts':
        "import AsyncStorage from '@react-native-async-storage/async-storage';\nexport const locale = AsyncStorage;\n",
    },
  },
  {
    num: 3,
    id: 'crypto-in-handoff',
    title: 'crypto, hmac or subtle under src/features/handoff',
    ruling: 'ADU-MOB-01 B12',
    check: (root) =>
      grep(root, { roots: ['apps/mobile/src/features/handoff'], pattern: /crypto|hmac|subtle/i }),
    fires: {
      'apps/mobile/src/features/handoff/sign.ts':
        "import { createHmac } from 'crypto';\nexport const s = createHmac;\n",
    },
    silent: {
      'apps/mobile/src/features/handoff/scan.ts':
        "export const tuple = { nonce: '', order_ref: '', signature: '' };\n",
    },
  },
  {
    num: 4,
    id: 'local-notification',
    title: 'scheduleNotificationAsync anywhere under apps/mobile',
    ruling: 'ADU-MOB-01 B15',
    check: (root) => grep(root, { roots: WHOLE_APP, pattern: /scheduleNotificationAsync/ }),
    fires: {
      'apps/mobile/src/notifications/remind.ts':
        "import * as N from 'expo-notifications';\nexport const r = () => N.scheduleNotificationAsync({});\n",
    },
    silent: {
      'apps/mobile/src/notifications/register.ts':
        "import * as N from 'expo-notifications';\nexport const r = () => N.getExpoPushTokenAsync();\n",
    },
  },
  {
    num: 5,
    id: 'persisted-response',
    title: 'a Query persister anywhere under apps/mobile (the /v1/ response written to storage)',
    ruling: 'ADU-MOB-01 S9.2',
    check: (root) =>
      grep(root, {
        roots: WHOLE_APP,
        pattern:
          /persistQueryClient|PersistQueryClientProvider|createAsyncStoragePersister|createSyncStoragePersister|experimental_createPersister|experimental_createQueryPersister|query-async-storage-persister|query-sync-storage-persister|query-persist-client-core/,
      }),
    fires: {
      'apps/mobile/src/api/query.ts':
        "import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';\nexport const P = PersistQueryClientProvider;\n",
    },
    silent: {
      'apps/mobile/src/api/query.ts':
        "import { QueryClientProvider } from '@tanstack/react-query';\nexport const P = QueryClientProvider;\n",
    },
  },
  {
    num: 6,
    id: 'seller-scope-in-buyer-mode',
    title: 'X-Adulis-Seller or as=seller under Buyer Mode routes',
    ruling: 'ADU-MOB-01 S17.3',
    check: (root) =>
      grep(root, {
        roots: APP_AND_SRC,
        pattern: /x-adulis-seller|as=seller|\bas\s*:\s*['"]seller['"]/i,
        exclude: [/^apps\/mobile\/app\/\(seller\)\//],
      }),
    fires: {
      'apps/mobile/src/features/chat/list.ts': "export const h = { 'x-adulis-seller': id };\n",
    },
    silent: {
      'apps/mobile/app/(seller)/inbox.tsx': "export const url = '/v1/conversations?as=seller';\n",
    },
  },
  {
    num: 7,
    id: 'price-or-tier-in-mobile-locale',
    title:
      'tier, subscription or billing terms, tier names or currency marks in the catalogue keys a MOBILE session renders',
    ruling: 'ADU-MOB-01 S16, S5.1',
    check: checkMobileLocale,
    fires: {
      'packages/locale/src/en.ts':
        "export const en = {\n  'mobile.chat.cap': 'Upgrade to the Pro tier for more replies.',\n};\n",
      [OVERRIDES]: JSON.stringify({ overrides: [] }),
    },
    silent: {
      'packages/locale/src/en.ts': [
        'export const en = {',
        "  'console.billing.price': 'Price: 1,200 ETB per month',",
        "  'error.cart_line.price_changed': 'The price has changed.',",
        "  'error.seller.tier_limit_reached': 'Your current plan does not include this.',",
        "  'mobile.chat.cap': 'Custom replies are configured in the Seller Console.',",
        '};',
        '',
      ].join('\n'),
      [OVERRIDES]: JSON.stringify({
        overrides: [
          { key: 'error.seller.tier_limit_reached', replacedBy: 'mobile.error.tier_limit_reached' },
        ],
      }),
    },
  },
  {
    num: 8,
    id: 'webview-outside-embed',
    title: 'a WebView outside features/storefront/embed',
    ruling: 'ADU-MOB-01 B8',
    check: (root) =>
      grep(root, {
        roots: APP_AND_SRC,
        pattern: /\bWebView\b|react-native-webview/,
        exclude: [/^apps\/mobile\/src\/features\/storefront\/embed\//],
      }),
    fires: {
      'apps/mobile/src/features/payment/help.tsx':
        "import { WebView } from 'react-native-webview';\nexport const H = WebView;\n",
    },
    silent: {
      'apps/mobile/src/features/storefront/embed/Embed.tsx':
        "import { WebView } from 'react-native-webview';\nexport const E = WebView;\n",
    },
  },
  {
    num: 9,
    id: 'unreviewed-dependency',
    title: 'a dependency not in the reviewed manifest, or a version that is a range',
    ruling: 'ADU-MOB-01 B2, S20.4',
    check: checkDependencies,
    fires: {
      [PACKAGE_JSON]: JSON.stringify({
        dependencies: { expo: '57.0.20', 'some-analytics-sdk': '^1.0.0' },
        devDependencies: {},
      }),
      [MANIFEST]: JSON.stringify({
        dependencies: { expo: { why: 'x', processor: false } },
        devDependencies: {},
      }),
    },
    silent: {
      [PACKAGE_JSON]: JSON.stringify({
        dependencies: { expo: '57.0.20', '@adulis/tokens': 'workspace:*' },
        devDependencies: { typescript: '5.9.3' },
      }),
      [MANIFEST]: JSON.stringify({
        dependencies: {
          expo: { why: 'x', processor: false },
          '@adulis/tokens': { why: 'x', processor: false },
        },
        devDependencies: { typescript: { why: 'x', processor: false } },
      }),
    },
  },
  {
    num: 10,
    id: 'queue-identifiers',
    title: GATE_10_TEXT,
    ruling: 'ADU-MOB-01 B25, B6, S9.5 (v1.3: D-365, D-380)',
    check: checkNoQueue,
    fires: {
      'apps/mobile/src/features/handoff/offline.ts':
        "import * as BackgroundFetch from 'expo-background-fetch';\nexport const handoff = BackgroundFetch;\n",
      'apps/mobile/src/lib/pending.ts': 'export const scanQueue = [];\n',
      'apps/mobile/src/lib/sync.ts': 'export const pendingSync = [];\n',
      'apps/mobile/src/lib/cache.ts':
        "import * as SQLite from 'expo-sqlite';\nexport const db = SQLite;\n",
    },
    silent: {
      'apps/mobile/src/store/idempotency.ts':
        "import * as SQLite from 'expo-sqlite';\n// the one row: the order idempotency key\nexport const db = SQLite;\n",
      'apps/mobile/src/lib/tick.ts': 'export const later = (f) => queueMicrotask(f);\n',
      // 10a is an import check: declaring the module is how the one store works.
      'apps/mobile/app.config.ts': "export default { plugins: ['expo-sqlite'] };\n",
      'apps/mobile/package.json': '{ "dependencies": { "expo-sqlite": "57.0.2" } }\n',
    },
  },
  {
    num: 11,
    id: 'audience-in-verify',
    title: 'audience in the OTP verify request body (it is stamped on the challenge)',
    ruling: 'ADU-MOB-01 S4.3, D-180 (v1.3: D-366)',
    check: checkAudienceInVerify,
    fires: {
      'apps/mobile/src/session/otp.ts':
        "export const challenge = (phone) =>\n  post('/v1/auth/otp/request', { phone, purpose: 'SIGN_IN', audience: 'MOBILE' });\n" +
        "export const verify = (id, code) =>\n  post('/v1/auth/otp/verify', { challenge_id: id, code, device_id: '', audience: 'MOBILE' });\n",
      // The gate must FAIL, not go quiet, when it cannot read the body.
      'apps/mobile/src/session/otp-indirect.ts':
        "const body = { challenge_id: '', code: '' };\n" +
        "export const challenge = (phone) =>\n  post('/v1/auth/otp/request', { phone, audience: 'MOBILE' });\n" +
        "export const verify = () => post('/v1/auth/otp/verify', body);\n",
    },
    silent: {
      // The challenge carries audience because S4.3 requires it; verify does not.
      'apps/mobile/src/session/otp.ts':
        "export const challenge = (phone) =>\n  post('/v1/auth/otp/request', { phone, purpose: 'SIGN_IN', audience: 'MOBILE' });\n" +
        "export const verify = (id, code) =>\n  post('/v1/auth/otp/verify', { challenge_id: id, code, device_id: '' });\n",
    },
  },
  {
    num: 12,
    id: 'hex-outside-tokens',
    title: 'a hex colour literal outside packages/tokens',
    ruling: 'ADU-MOB-03 D5',
    check: (root) =>
      grep(root, {
        roots: ['apps/mobile', 'packages'],
        pattern: HEX,
        exclude: [/^packages\/tokens\//],
      }),
    fires: {
      'apps/mobile/src/components/Card.tsx': "export const s = { backgroundColor: '#1e40af' };\n",
      'apps/mobile/src/components/Row.tsx': "export const s = { color: '#fff' };\n",
    },
    silent: {
      'packages/tokens/src/native/extra.ts': "export const c = '#1e40af';\n",
      'apps/mobile/src/lib/ref.ts':
        "export const r = '#/components/schemas/Order'; // a JSON pointer, not a colour\nclass K { #add = 1; get v() { return this.#add; } }\nexport const k = new K();\n",
    },
  },
  {
    num: 13,
    id: 'ethiopic-family-in-src',
    title: 'NotoSansEthiopic anywhere under apps/mobile/src',
    ruling: 'ADU-MOB-03 D2',
    check: (root) => grep(root, { roots: ['apps/mobile/src'], pattern: /NotoSansEthiopic/ }),
    fires: {
      'apps/mobile/src/components/Amharic.tsx':
        "export const s = { fontFamily: 'NotoSansEthiopic' };\n",
    },
    silent: {
      'apps/mobile/app/_layout.tsx':
        'export const f = { NotoSansEthiopic: 1 }; // loading the file is app/, not src/\n',
    },
  },
  {
    num: 14,
    id: 'include-font-padding',
    title: 'includeFontPadding anywhere',
    ruling: 'ADU-MOB-03 D1',
    check: (root) =>
      grep(root, {
        roots: ['apps/mobile', 'packages'],
        pattern: /includeFontPadding/,
        exclude: [TEST_FILE],
        strip: true,
      }),
    fires: {
      'apps/mobile/src/components/Text.tsx': 'export const s = { includeFontPadding: false };\n',
    },
    silent: {
      'apps/mobile/src/components/Text.tsx':
        '// includeFontPadding is banned (D1); naming the rule in a comment is not a violation of it\nexport const s = { lineHeight: 24 };\n',
      'apps/mobile/__tests__/Text.test.tsx':
        "expect(style).not.toHaveProperty('includeFontPadding');\n",
    },
  },
  {
    num: 15,
    id: 'playwright-in-mobile',
    title: 'an import of playwright or @playwright/* under apps/mobile',
    ruling: 'ADU-MOB-08 S40, S42',
    check: (root) =>
      grep(root, { roots: WHOLE_APP, pattern: PLAYWRIGHT_IMPORT, strip: true }).map((h) => ({
        ...h,
        text: `${h.text}  (Maestro is the native e2e tool; Playwright is NOT PRIMARY for the native app -- S40, S42)`,
      })),
    fires: {
      'apps/mobile/e2e/scan.spec.ts':
        "import { test, expect } from '@playwright/test';\nexport const t = test;\n",
      'apps/mobile/src/lib/browser.ts':
        "const { chromium } = require('playwright');\nexport const c = chromium;\n",
    },
    silent: {
      // Naming the rule is not breaking it, and a declaration is gate 9's job.
      'apps/mobile/src/lib/note.ts':
        '// playwright is not the native e2e tool; Maestro is (ADU-MOB-08 S40)\nexport const x = 1;\n',
      'apps/mobile/package.json': '{ "devDependencies": { "playwright": "1.0.0" } }\n',
    },
  },
];

/** Write a fixture tree { relPath: content } under root. */
function plant(root, fixture) {
  for (const [rel, content] of Object.entries(fixture)) {
    const abs = path.join(root, ...rel.split('/'));
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
}

/** Every gate catches EVERY planted violation and stays silent on the allowed placement. */
export function selfTest() {
  const results = [];
  for (const gate of GATES) {
    const dirty = mkdtempSync(path.join(os.tmpdir(), `adulis-gate-${gate.num}-fires-`));
    const clean = mkdtempSync(path.join(os.tmpdir(), `adulis-gate-${gate.num}-silent-`));
    try {
      plant(dirty, gate.fires);
      plant(clean, gate.silent);
      const fired = gate.check(dirty);
      const silent = gate.check(clean);
      const violatingFiles = Object.keys(gate.fires).filter(
        (f) => f !== MANIFEST && f !== OVERRIDES,
      );
      const caughtFiles = new Set(fired.map((h) => h.file));
      const allCaught =
        gate.num === 9 ? fired.length > 0 : violatingFiles.every((f) => caughtFiles.has(f));
      results.push({
        gate,
        ok: fired.length > 0 && allCaught && silent.length === 0,
        fired,
        silent,
      });
    } finally {
      rmSync(dirty, { recursive: true, force: true });
      rmSync(clean, { recursive: true, force: true });
    }
  }
  return { ok: results.every((r) => r.ok), results };
}

/** Run every gate against a real tree. */
export function runAll(root = REPO_ROOT) {
  const results = GATES.map((gate) => {
    const hits = gate.check(root);
    return { gate, ok: hits.length === 0, hits };
  });
  return { ok: results.every((r) => r.ok), results };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = process.argv.slice(2);
  const rootIdx = args.indexOf('--root');
  const root = rootIdx >= 0 ? path.resolve(args[rootIdx + 1]) : REPO_ROOT;
  let failed = false;

  if (args.includes('--self-test')) {
    console.log('\nmobile gates -- do the fifteen actually fire? (planted in a throwaway tree)');
    const st = selfTest();
    for (const r of st.results) {
      const label = `${String(r.gate.num).padStart(2, ' ')} ${r.gate.id}`;
      if (r.ok)
        console.log(
          `  PASS  ${label.padEnd(42)} fires on every planted file, silent on the allowed placement`,
        );
      else {
        console.log(
          `  FAIL  ${label.padEnd(42)} fired=${r.fired.length} silent-hits=${r.silent.length}`,
        );
        for (const h of r.fired) console.log(`          fired:      ${h.file}:${h.line} ${h.text}`);
        for (const h of r.silent)
          console.log(`          unexpected: ${h.file}:${h.line} ${h.text}`);
      }
    }
    failed ||= !st.ok;
  }

  console.log(`\nmobile gates -- ADU-MOB-01 S18.1 / ADU-MOB-03 S8, against ${root}`);
  const run = runAll(root);
  for (const r of run.results) {
    const label = `${String(r.gate.num).padStart(2, ' ')} ${r.gate.id}`;
    if (r.ok) console.log(`  PASS  ${label.padEnd(42)} 0  (${r.gate.ruling})`);
    else {
      console.log(
        `  FAIL  ${label.padEnd(42)} ${r.hits.length}  (${r.gate.ruling}) -- ${r.gate.title}`,
      );
      for (const h of r.hits.slice(0, 20))
        console.log(`          ${h.file}${h.line ? `:${h.line}` : ''}  ${h.text}`);
      if (r.hits.length > 20) console.log(`          ... and ${r.hits.length - 20} more`);
    }
  }
  failed ||= !run.ok;

  console.log(
    failed
      ? '\nFAIL  mobile gates. Red on any; there is no skip label (ADU-CON-02 S16).\n'
      : '\nPASS  all fifteen mobile gates.\n',
  );
  process.exit(failed ? 1 : 0);
}
