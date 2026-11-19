// The flows a native run may execute. The Maestro files under apps/mobile/.maestro are the SOURCE of the
// allow-list, never the list itself: ops/native/flows.json names each approved flow, pins the SHA-256 of
// its content and declares what the file does to the device (clears the app's data, grants a permission,
// ...). A flow whose content differs from its pin is refused, every time, right before Maestro starts it;
// re-pinning is a reviewed change to flows.json. The scan below is the second layer: it is what a reviewer
// is shown when a flow is pinned, and it refuses the hazards of the NEVER list whatever a declaration says.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
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
];
/** The only permission grants a declaration may name: `<permission>:<allow|deny|unset>`. */
export const ALLOWED_PERMISSIONS = ['android.permission.ACCESS_LOCAL_NETWORK:allow'];
/** Keys a flow may press: navigation and text entry, never power, volume, lock or a camera key. */
const SAFE_KEYS = new Set(['Enter', 'Backspace', 'Back', 'Home', 'Tab', 'Escape']);

const COMMANDS = {
  clearKeychain: 'clearKeychain',
  script: 'runScript|evalScript',
  media: 'addMedia',
  location: 'setLocation|travel',
  airplane: 'setAirplaneMode|toggleAirplaneMode',
  orientation: 'setOrientation',
  recording: 'startRecording|stopRecording',
  'cloud-ai': 'assertWithAI|extractTextWithAI|assertNoDefectsWithAI',
  clipboard: 'copyTextFrom|pasteText|setClipboard',
  'app-stop': 'stopApp|killApp',
};

// A command in block form (`- name`, `- {name: x}`) or inside a flow-style map or list (`{a: 1, name: x}`).
const START = String.raw`(?:^\s*-\s*\{?\s*|[{,\[]\s*)`;
const unquote = (s) => `${s}`.replace(/^['"]|['"]$/g, '');
// Expressions of a flow may compare variables; anything that calls, indexes or reaches out is a script.
const SIMPLE_EXPRESSION = /^[A-Za-z0-9_ ='"!|&<>-]+$/;
const BUILTINS = new Set(['maestro.platform', 'maestro.copiedText']);

/** The content hash that pins a flow: SHA-256 of its bytes with CRLF read as LF (the repository checks out LF). */
export function flowHash(buffer) {
  const lf = Buffer.from(buffer.toString('latin1').replaceAll('\r\n', '\n'), 'latin1');
  return createHash('sha256').update(lf).digest('hex');
}

/** What a flow file does, read from its text (comments are not code). */
export function scanFlow(text) {
  const src = text
    .replaceAll('\r', '')
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
  const hazards = new Set();
  const appId = /^appId:[ \t]*(\S+)/m.exec(src)?.[1] ?? null;
  const foreign = (v) => {
    if (v !== appId) hazards.add('foreign-app');
  };
  // clearState: `true` (an option of launchApp or a command), or a package (string form of the command)
  for (const m of src.matchAll(/(?:^\s*(?:-\s*)?|[{,]\s*)clearState:[ \t]*([^\s,}\]]+)/gm)) {
    if (m[1] === 'false') continue;
    hazards.add('clearState');
    if (m[1] !== 'true') foreign(unquote(m[1]));
  }
  if (new RegExp(`${START}clearState\\b(?!:)`, 'm').test(src)) hazards.add('clearState');
  for (const [name, cmds] of Object.entries(COMMANDS))
    if (new RegExp(`${START}(?:${cmds})\\b`, 'm').test(src)) hazards.add(name);
  // launchApp, stopApp and killApp may name a package (string form): it must be this app
  for (const m of src.matchAll(
    new RegExp(`${START}(?:launchApp|stopApp|killApp):[ \\t]*([^\\s,}\\]]+)`, 'gm'),
  ))
    if (!m[1].startsWith('{') && !m[1].startsWith('[')) foreign(unquote(m[1]));
  for (const m of src.matchAll(/(?:^\s+|[{,]\s*)appId:[ \t]*([^\s,}\]]+)/gm))
    foreign(unquote(m[1]));
  // The value must sit on the same line: `runFlow:` followed by a block is an inline flow, not a file.
  if (
    new RegExp(`${START}runFlow:[ \\t]*[^\\s{]`, 'm').test(src) ||
    /(?:^\s*|[{,]\s*)file:[ \t]*\S/m.test(src)
  )
    hazards.add('runFlow-file');
  if (/(?:^\s*|[{,]\s*)while:/m.test(src)) hazards.add('loop-while');
  // permissions: the block form (indented `name: value` lines) and the flow-style form
  const permissions = new Set();
  const take = (s) => {
    for (const p of s.matchAll(/([A-Za-z0-9_.]+)\s*:\s*([A-Za-z]+)/g))
      permissions.add(`${p[1]}:${p[2]}`);
  };
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    const m = /^(\s*)permissions:[ \t]*(.*)$/.exec(line);
    if (!m) return;
    hazards.add('permission-grant');
    if (m[2].trim()) take(m[2]);
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = /^(\s*)(\S.*)$/.exec(lines[j]);
      if (!next) continue;
      if (next[1].length <= m[1].length) break;
      take(next[2]);
    }
  });
  for (const m of src.matchAll(/[{,]\s*permissions:\s*\{([^}]*)\}/g)) {
    hazards.add('permission-grant');
    take(m[1]);
  }
  // a grant that could not be read is never an empty grant
  if (/\bpermissions:/.test(src) && !permissions.size) {
    hazards.add('permission-grant');
    permissions.add('(none readable)');
  }
  // links: the string form and the map form (`link:`), quoted or not
  const links = [
    ...[...src.matchAll(new RegExp(`${START}openLink:[ \\t]*([^\\s{,}]+)`, 'gm'))].map((m) => m[1]),
    ...[...src.matchAll(/(?:^\s+|[{,]\s*)link:[ \t]*([^\s,}]+)/gm)].map((m) => m[1]),
  ].map(unquote);
  if (links.some((l) => !l.startsWith('adulis://'))) hazards.add('external-link');
  for (const m of src.matchAll(new RegExp(`${START}pressKey:[ \\t]*([^\\s,}\\]]+)`, 'gm')))
    if (!SAFE_KEYS.has(unquote(m[1]))) hazards.add('hardware-key');
  if (new RegExp(`${START}pressKey:[ \\t]*$`, 'm').test(src)) hazards.add('hardware-key');
  // ${...}: a variable, a comparison of variables, a Maestro built-in, or a script
  const names = new Set();
  for (const m of src.matchAll(/\$\{([^}]*)\}/g)) {
    const inner = m[1].trim();
    if (BUILTINS.has(inner)) continue;
    if (!SIMPLE_EXPRESSION.test(inner)) {
      hazards.add('expression');
      continue;
    }
    for (const id of inner.replace(/'[^']*'|"[^"]*"/g, '').matchAll(/[A-Za-z_][A-Za-z0-9_]*/g))
      if (!['true', 'false', 'null'].includes(id[0])) names.add(id[0]);
  }
  return {
    appId,
    hazards: [...hazards].sort(),
    vars: [...names].sort(),
    permissions: [...permissions].sort(),
  };
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
    if (pinned.problem) problems.push(`flow '${fname}': ${pinned.problem}`);
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
