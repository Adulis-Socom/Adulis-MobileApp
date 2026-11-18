// The flows a native run may execute. The Maestro files under apps/mobile/.maestro are the SOURCE of the
// allow-list, never the list itself: ops/native/flows.json names each approved flow and declares what
// the file does to the device (clears the app's data, grants a permission, ...). Every run reads the
// flow file again and compares what it finds with the declaration: a flow that gained a hazard, or a file
// that is not declared, is refused. A hazard on the NEVER list is refused whatever the declaration says.
import { readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { APP_ID } from './device.mjs';
import { SETTINGS } from './settings.mjs';

/** What a declaration may state, and what no declaration can make acceptable. */
export const ALLOWED_HAZARDS = ['clearState', 'permission-grant', 'app-stop', 'loop-while'];
export const NEVER_HAZARDS = [
  'clearKeychain',
  'script',
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
];

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

/** What a flow file does, read from its text (comments are not code). */
export function scanFlow(text) {
  const src = text
    .replaceAll('\r', '')
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
  const hazards = new Set();
  if (/^\s*(?:-\s*)?clearState:[ \t]*true\b/m.test(src) || /^\s*-\s*clearState\b/m.test(src))
    hazards.add('clearState');
  for (const [name, cmds] of Object.entries(COMMANDS))
    if (new RegExp(`^\\s*-\\s*(?:${cmds})\\b`, 'm').test(src)) hazards.add(name);
  // The value must sit on the same line: `runFlow:` followed by a block is an inline flow, not a file.
  if (/^\s*-\s*runFlow:[ \t]*\S/m.test(src) || /^\s*file:[ \t]*\S/m.test(src))
    hazards.add('runFlow-file');
  if (/^\s*while:/m.test(src)) hazards.add('loop-while');
  if (/^\s*permissions:/m.test(src)) hazards.add('permission-grant');
  const links = [...src.matchAll(/^\s*-\s*openLink:[ \t]*(\S+)/gm)].map((m) => m[1]);
  if (links.some((l) => !l.startsWith('adulis://'))) hazards.add('external-link');
  const appId = /^appId:[ \t]*(\S+)/m.exec(src)?.[1] ?? null;
  if ([...src.matchAll(/^\s+appId:[ \t]*(\S+)/gm)].some((m) => m[1] !== appId))
    hazards.add('foreign-app');
  const vars = [...new Set([...src.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => m[1]))]
    .filter((v) => !v.startsWith('maestro'))
    .sort();
  return { appId, hazards: [...hazards].sort(), vars };
}

export function loadDeclaration(path) {
  const d = JSON.parse(readFileSync(path, 'utf8'));
  if (!d || typeof d !== 'object' || typeof d.flows !== 'object' || typeof d.batteries !== 'object')
    throw new Error(`${path} is not a flow declaration`);
  return d;
}

const FILE_RE = /^[a-z0-9][a-z0-9-]*\.yaml$/;
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

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
