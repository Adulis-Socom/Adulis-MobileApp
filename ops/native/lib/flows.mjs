// The flows a native run may execute. The Maestro files under apps/mobile/.maestro are the SOURCE of the
// allow-list, never the list itself: ops/native/flows.json names each approved flow, pins the SHA-256 of
// its content and declares what the file does to the device (clears the app's data, grants a permission,
// ...). A flow whose content differs from its pin is refused, every time, right before Maestro starts it;
// re-pinning is a reviewed change to flows.json. The scan below is the second layer: it parses the file as
// YAML (so spelling, quoting, anchors and line breaks do not matter), allows only the commands on the lists
// below, and is what a reviewer is shown when a flow is pinned. A command or an option that is not on a list
// is refused, whatever a declaration says.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { parseAllDocuments } from 'yaml';
import { APP_ID } from './device.mjs';
import { SETTINGS } from './settings.mjs';

/** What a declaration may state, and what no declaration can make acceptable. */
export const ALLOWED_HAZARDS = ['clearState', 'permission-grant', 'app-stop', 'loop-while'];
export const NEVER_HAZARDS = [
  'clearKeychain',
  'script',
  'expression',
  'runFlow-file',
  'media',
  'location',
  'airplane',
  'orientation',
  'recording',
  'cloud-ai',
  'clipboard',
  'external-link',
  'foreign-app',
  'hardware-key',
  'unknown-command',
  'unparseable',
];
/** The only permission grants a declaration may name: `<permission>:<allow|deny|unset>`. */
export const ALLOWED_PERMISSIONS = ['android.permission.ACCESS_LOCAL_NETWORK:allow'];
/** Keys a flow may press: navigation and text entry, never power, volume, lock or a camera key. */
const SAFE_KEYS = new Set(['Enter', 'Backspace', 'Back', 'Home', 'Tab', 'Escape']);

// Commands that are refused whatever a declaration says, by the hazard they stand for.
const NEVER_COMMANDS = {
  clearKeychain: 'clearKeychain',
  runScript: 'script',
  evalScript: 'script',
  addMedia: 'media',
  setLocation: 'location',
  travel: 'location',
  setAirplaneMode: 'airplane',
  toggleAirplaneMode: 'airplane',
  setOrientation: 'orientation',
  startRecording: 'recording',
  stopRecording: 'recording',
  assertWithAI: 'cloud-ai',
  extractTextWithAI: 'cloud-ai',
  assertNoDefectsWithAI: 'cloud-ai',
  copyTextFrom: 'clipboard',
  pasteText: 'clipboard',
  setClipboard: 'clipboard',
};
// Commands that only look at or touch the screen. Every command that is not handled by name in `command`
// below and is not in this list is refused as an unknown command (deny by default).
const UI_COMMANDS = new Set([
  'tapOn',
  'doubleTapOn',
  'longPressOn',
  'assertVisible',
  'assertNotVisible',
  'inputText',
  'eraseText',
  'back',
  'hideKeyboard',
  'scroll',
  'scrollUntilVisible',
  'swipe',
  'waitForAnimationToEnd',
  'extendedWaitUntil',
  'takeScreenshot',
]);
// The options of launchApp; any other option is refused.
const LAUNCH_OPTIONS = new Set([
  'appId',
  'clearState',
  'clearKeychain',
  'stopApp',
  'permissions',
  'arguments',
  'label',
]);

// Expressions of a flow may compare variables; anything that calls, indexes or reaches out is a script.
const SIMPLE_EXPRESSION = /^[A-Za-z0-9_ ='"!|&<>-]+$/;
const BUILTINS = new Set(['maestro.platform', 'maestro.copiedText']);

/** The content hash that pins a flow: SHA-256 of its bytes with CRLF read as LF (the repository checks out LF). */
export function flowHash(buffer) {
  const lf = Buffer.from(buffer.toString('latin1').replaceAll('\r\n', '\n'), 'latin1');
  return createHash('sha256').update(lf).digest('hex');
}

const isMap = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** What a flow file does, read from its YAML (comments are not code): { appId, hazards, vars, permissions }. */
export function scanFlow(text) {
  const hazards = new Set();
  const names = new Set();
  const permissions = new Set();
  const unparseable = () => hazards.add('unparseable');
  const result = (appId) => ({
    appId,
    hazards: [...hazards].sort(),
    vars: [...names].sort(),
    permissions: [...permissions].sort(),
  });

  let values;
  try {
    const docs = parseAllDocuments(text, { maxAliasCount: 50 });
    if (docs.some((d) => d.errors.length)) {
      unparseable();
      return result(null);
    }
    values = docs.map((d) => d.toJS());
  } catch {
    unparseable();
    return result(null);
  }

  let appId = null;
  const foreign = (v) => {
    if (v !== appId) hazards.add('foreign-app');
  };
  const link = (v) => {
    if (typeof v !== 'string' || !v.startsWith('adulis://')) hazards.add('external-link');
  };
  const grant = (v) => {
    hazards.add('permission-grant');
    const entries = isMap(v) ? Object.entries(v) : [];
    if (!entries.length) permissions.add('(none readable)'); // a grant that cannot be read is never an empty grant
    for (const [p, w] of entries) permissions.add(`${p}:${w}`);
  };
  // ${...}: a variable, a comparison of variables, a Maestro built-in, or a script
  const expressions = (s) => {
    for (const m of s.matchAll(/\$\{([^}]*)\}/g)) {
      const inner = m[1].trim();
      if (BUILTINS.has(inner)) continue;
      if (!SIMPLE_EXPRESSION.test(inner)) {
        hazards.add('expression');
        continue;
      }
      for (const id of inner.replace(/'[^']*'|"[^"]*"/g, '').matchAll(/[A-Za-z_][A-Za-z0-9_]*/g))
        if (!['true', 'false', 'null'].includes(id[0])) names.add(id[0]);
    }
    if (s.replace(/\$\{[^}]*\}/g, '').includes('${')) hazards.add('expression'); // never closed: not a variable
  };
  // every string, key or value, anywhere below `v`; and the keys that mean something wherever they stand
  const walk = (v) => {
    if (typeof v === 'string') expressions(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (isMap(v))
      for (const [k, w] of Object.entries(v)) {
        expressions(k);
        if (k === 'appId') foreign(w);
        else if (k === 'file') hazards.add('runFlow-file');
        else if (k === 'while') hazards.add('loop-while');
        else if (k === 'permissions') grant(w);
        else if (k === 'link') link(w);
        else if (k === 'clearKeychain' && w !== false) hazards.add('clearKeychain');
        else if (k === 'clearState' && w !== false) {
          hazards.add('clearState');
          if (typeof w === 'string') foreign(w); // the string form names a package
        }
        walk(w);
      }
  };
  const key = (v) => {
    if (typeof v !== 'string' || !SAFE_KEYS.has(v)) hazards.add('hardware-key');
  };
  const command = (name, args) => {
    if (typeof name !== 'string') return unparseable();
    if (Object.hasOwn(NEVER_COMMANDS, name)) hazards.add(NEVER_COMMANDS[name]);
    else if (name === 'clearState') {
      hazards.add('clearState');
      if (typeof args === 'string') foreign(args);
    } else if (name === 'stopApp' || name === 'killApp') {
      hazards.add('app-stop');
      if (typeof args === 'string') foreign(args);
    } else if (name === 'launchApp') {
      if (typeof args === 'string') foreign(args);
      else if (isMap(args)) {
        for (const k of Object.keys(args))
          if (!LAUNCH_OPTIONS.has(k)) hazards.add('unknown-command');
      } else if (args !== null) unparseable();
    } else if (name === 'openLink') link(isMap(args) ? args.link : args);
    else if (name === 'runFlow') {
      if (typeof args === 'string') hazards.add('runFlow-file');
      else if (isMap(args)) commands(args.commands);
      else unparseable();
    } else if (name === 'repeat' || name === 'retry') {
      if (isMap(args)) commands(args.commands);
      else unparseable();
    } else if (name === 'pressKey') key(isMap(args) ? args.key : args);
    else if (!UI_COMMANDS.has(name)) hazards.add('unknown-command');
    walk(args);
  };
  const commands = (list) => {
    if (list === undefined) return;
    if (!Array.isArray(list)) return unparseable();
    for (const c of list) {
      if (typeof c === 'string') command(c, null);
      else if (isMap(c) && Object.keys(c).length === 1)
        command(Object.keys(c)[0], Object.values(c)[0]);
      else unparseable();
    }
  };

  const [config, body, ...extra] = values;
  if (extra.length) unparseable();
  if (isMap(config)) {
    appId = typeof config.appId === 'string' ? config.appId : null;
    walk(config);
    commands(config.onFlowStart);
    commands(config.onFlowComplete);
  } else unparseable();
  if (Array.isArray(body)) commands(body);
  else if (body !== undefined && body !== null) unparseable();
  return result(appId);
}

export function loadDeclaration(path) {
  const d = JSON.parse(readFileSync(path, 'utf8'));
  if (!d || typeof d !== 'object' || typeof d.flows !== 'object' || typeof d.batteries !== 'object')
    throw new Error(`${path} is not a flow declaration`);
  return d;
}

const FILE_RE = /^[a-z0-9][a-z0-9-]*\.yaml$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

/**
 * The flow file as it is now: Resolves { buffer } when its content is the pinned one, else { problem }.
 * Called by resolveBattery and again right before every Maestro start.
 */
export function verifyFlowFile(file, pin) {
  let buffer;
  try {
    buffer = readFileSync(file);
  } catch (e) {
    return { problem: `the flow file cannot be read (${e.message})` };
  }
  const got = flowHash(buffer);
  if (!HASH_RE.test(`${pin}`))
    return { problem: 'the flow has no content pin (sha256) in the declaration' };
  if (got !== pin)
    return {
      problem: `the flow file changed: its content hash is ${got}, the pin is ${pin} (review it and re-pin it in flows.json)`,
    };
  return { buffer };
}

/**
 * Every reason the battery may not run: the declaration itself, and each flow file compared with it.
 * Resolves { problems, flows: [{ name, file, decl, scan }] } (`flows` only when there are no problems).
 */
export function resolveBattery(decl, name, flowDir) {
  const problems = [];
  if (decl.appId !== APP_ID) problems.push(`the declaration is for ${decl.appId}, not ${APP_ID}`);
  const battery = Object.hasOwn(decl.batteries, name) ? decl.batteries[name] : null;
  if (!battery)
    return {
      problems: [
        `'${name}' is not a declared battery (known: ${Object.keys(decl.batteries).join(', ')})`,
      ],
    };
  const flows = [];
  for (const fname of battery.flows ?? []) {
    const d = Object.hasOwn(decl.flows, fname) ? decl.flows[fname] : null;
    if (!d) {
      problems.push(`flow '${fname}' is not declared`);
      continue;
    }
    if (!FILE_RE.test(`${d.file}`)) {
      problems.push(`flow '${fname}' names a file that is not a plain flow file name`);
      continue;
    }
    const file = resolve(flowDir, d.file);
    if (!file.startsWith(resolve(flowDir) + sep)) {
      problems.push(`flow '${fname}' resolves outside ${flowDir}`);
      continue;
    }
    const pinned = verifyFlowFile(file, d.sha256);
    if (pinned.problem) {
      problems.push(`flow '${fname}': ${pinned.problem}`); // a flow that is not the pinned one is not read further
      continue;
    }
    let scan;
    try {
      scan = scanFlow(readFileSync(file, 'utf8'));
    } catch (e) {
      problems.push(`flow '${fname}' cannot be read (${e.message})`);
      continue;
    }
    if (scan.appId !== decl.appId)
      problems.push(`flow '${fname}' runs app ${scan.appId}, not ${decl.appId}`);
    for (const h of scan.hazards)
      if (NEVER_HAZARDS.includes(h))
        problems.push(`flow '${fname}' uses '${h}', which no declaration can approve`);
    if (!same(scan.hazards, d.hazards ?? []))
      problems.push(
        `flow '${fname}' does to the device [${scan.hazards.join(', ')}] but is declared as [${(d.hazards ?? []).join(', ')}]: re-declare it before it runs`,
      );
    for (const h of d.hazards ?? [])
      if (!ALLOWED_HAZARDS.includes(h))
        problems.push(`flow '${fname}' declares '${h}', which is not an allowed hazard`);
    if (!same(scan.permissions, d.permissions ?? []))
      problems.push(
        `flow '${fname}' grants permissions [${scan.permissions.join(', ')}] but declares [${(d.permissions ?? []).join(', ')}]`,
      );
    for (const p of d.permissions ?? [])
      if (!ALLOWED_PERMISSIONS.includes(p))
        problems.push(`flow '${fname}' declares the permission grant '${p}', which is not allowed`);
    if (!same(scan.vars, d.vars ?? []))
      problems.push(
        `flow '${fname}' needs variables [${scan.vars.join(', ')}] but declares [${(d.vars ?? []).join(', ')}]`,
      );
    if ((d.vars ?? []).length)
      problems.push(`flow '${fname}' needs variables: a battery with variables is not supported`);
    flows.push({ name: fname, file, decl: d, scan });
  }
  if (!flows.length && !problems.length) problems.push(`battery '${name}' has no flows`);
  if (battery.canary && !(battery.flows ?? []).includes(battery.canary))
    problems.push(`the canary flow '${battery.canary}' is not in the battery`);
  for (const [k, v] of Object.entries(battery.settings ?? {})) {
    if (!Object.hasOwn(SETTINGS, k))
      problems.push(`battery '${name}' sets '${k}', which is not a setting the driver may change`);
    else if (!SETTINGS[k].valid(`${v}`))
      problems.push(`battery '${name}' gives ${k} the value '${v}', which is not valid`);
  }
  return problems.length ? { problems } : { problems, flows, battery };
}

export const flowDirOf = (checkout) => join(checkout, 'apps', 'mobile', '.maestro');
