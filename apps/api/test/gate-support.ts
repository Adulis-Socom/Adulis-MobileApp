import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as ts from 'typescript';
import type { Route } from './contract-support';

/**
 * What each route's authorization gate admits, derived from the code and the
 * seed rather than restated: used by the spec that holds the contract's
 * `security`, `x-adulis-permission` and `x-adulis-surfaces` to the gates.
 *
 *  - permissionSurfaces(): the surfaces of every permission, read from the
 *    authority copy of the permission seed (the file permission-matrix.spec.ts
 *    compares the live database against), never from core.permission;
 *  - scanGates(): per controller method, the permissions its code can check
 *    and whether it refuses a non-CONSOLE session in code. A handler's reach is
 *    the handler plus every method it calls through `this` (its own helpers and
 *    the services it holds), and the SQL functions those methods name, whose
 *    gate lives in the migration that defines them.
 *
 * Reading the source (the way scanRoutes does) needs no database and no running API.
 *
 * KNOWN LIMITS. Everything below is text and AST reading, not execution.
 *  - A route's permissions are the UNION of every single-quoted permission literal reachable from its handler body
 *    (comments included; a quoted key of a lookup table is excluded), and the surfaces it admits are the
 *    INTERSECTION over that union. A handler that checks a Console-only permission in one branch and a
 *    mobile-capable one in another would be derived Console-only, and the spec would agree with a wrong
 *    cookie-only declaration. This FAILS OPEN: the two branchy routes that exist (the seller side of chat and
 *    notifications, and revoking another session) are listed by hand in SELLER_SIDE_ONLY and
 *    CONSOLE_CHECK_FOR_ANOTHER_SESSION_ONLY, and a new one has to be added there by whoever writes it.
 *  - Calls are followed only as this.method() and this.held.method() to a depth of four; a SQL function is read
 *    from the last migration that defines it and nested SQL functions are not followed; the audience check is
 *    recognised only as audience !== 'CONSOLE'. These FAIL SAFE: a protected route whose gate is not found fails
 *    the spec unless it is on the reviewed authenticated-only list.
 */

const ROOT = resolve(__dirname, '../../..');
const MODULES = resolve(__dirname, '../src/modules');
const SEED = join(ROOT, 'docs/amendments/ADU-AUTH-01_v2_4_permission_seed.sql');
const MIGRATIONS = join(ROOT, 'db/migrations');

export type Surface = 'MOBILE' | 'CONSOLE';

/** `'seller.x:y'` as a value. A quoted key (`'seller.x:y': true`) is a lookup table, not a gate. */
const PERMISSION_LITERAL = /'(seller\.[a-z_.]+:[a-z_]+)'(?!\s*:)/g;
const CONSOLE_CHECK = /audience\s*!==\s*'CONSOLE'/;
/** The request's Market comes from the account, else from the device named by X-Adulis-Device. */
const DEVICE_READ = /\brequesterMarket\(|\brequestingDevice\(|\bdeviceHeader\(|x-adulis-device/i;
const KEYED = /\.runIdempotent\(/;
/** The deletion ticket is read from `Authorization: Ticket <id>`. */
const TICKET_READ = /startsWith\('Ticket '\)/;

export function permissionSurfaces(): Map<string, Surface[]> {
  const seed = readFileSync(SEED, 'utf8');
  const parts = seed.split('INSERT INTO core.permission');
  if (parts.length !== 2) throw new Error(`${SEED}: expected exactly one INSERT INTO core.permission`);
  const block = (parts[1] ?? '').split(';')[0] ?? '';
  const out = new Map<string, Surface[]>();
  for (const m of block.matchAll(/\('([^']+)',\s*ARRAY\[([^\]]*)\]::core\.session_audience\[\]/g)) {
    const [, code, list] = m;
    if (code === undefined || list === undefined) continue;
    out.set(code, list.split(',').map((x) => x.trim().replace(/'/g, '') as Surface));
  }
  if (out.size === 0) throw new Error(`parsed no permission from ${SEED}`);
  return out;
}

/** The permission codes a SQL function checks, from the last migration that defines it. */
function sqlFunctionPermissions(name: string): string[] {
  let body: string | undefined;
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    const start = sql.search(new RegExp(`CREATE (OR REPLACE )?FUNCTION core\\.${name}\\(`));
    if (start < 0) continue;
    const tag = /AS (\$\w*\$)/.exec(sql.slice(start));
    if (!tag?.[1]) continue;
    const open = start + (tag.index ?? 0) + tag[0].length;
    body = sql.slice(open, sql.indexOf(tag[1], open));
  }
  if (body === undefined) return [];
  return [...body.matchAll(/fn_has_permission\s*\([^;]*?'(seller\.[a-z_.]+:[a-z_]+)'/g)].map((m) => m[1] as string);
}

interface ClassInfo {
  methods: Map<string, ts.MethodDeclaration>;
  /** constructor parameter name -> declared type name */
  fields: Map<string, string>;
}

export interface RouteGate {
  /** Permission codes the route's code can check (conditional ones included). */
  permissions: string[];
  /** The code refuses a session whose audience is not CONSOLE (it may do so for one case only). */
  consoleCheck: boolean;
  /** The code reads X-Adulis-Device: the Market of an anonymous or app request is the device's. */
  readsDevice: boolean;
  /** The code runs through runIdempotent, whose actor is the device when nobody is signed in. */
  keyed: boolean;
  /** The code reads the deletion ticket from the Authorization header. */
  readsTicket: boolean;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sourceFiles(join(dir, e.name))
      : e.name.endsWith('.ts') && !/\.(spec|dto|schemas)\.ts$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
}

let cached: Map<string, RouteGate> | undefined;

/** `${controllerClass}.${method}` -> its gate, for every controller method. */
export function scanGates(): Map<string, RouteGate> {
  if (cached) return cached;
  const classes = new Map<string, ClassInfo>();
  const controllers: string[] = [];
  for (const file of sourceFiles(MODULES)) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true);
    source.forEachChild((n) => {
      if (!ts.isClassDeclaration(n) || !n.name) return;
      const info: ClassInfo = { methods: new Map(), fields: new Map() };
      for (const m of n.members) {
        if (ts.isMethodDeclaration(m)) info.methods.set(m.name.getText(), m);
        if (ts.isConstructorDeclaration(m)) {
          for (const p of m.parameters) if (p.type) info.fields.set(p.name.getText(), p.type.getText());
        }
      }
      classes.set(n.name.text, info);
      if (file.endsWith('.controller.ts')) controllers.push(n.name.text);
    });
  }

  const reach = (cls: string, method: string, seen: Set<string>, acc: { permissions: Set<string>; consoleCheck: boolean; readsDevice: boolean; keyed: boolean; readsTicket: boolean }, depth: number): void => {
    const info = classes.get(cls);
    const node = info?.methods.get(method);
    if (!info || !node || seen.has(`${cls}.${method}`)) return;
    seen.add(`${cls}.${method}`);
    // The body only: a method's decorators (ApiGate among them) state the gate, they are not evidence of it.
    const text = node.body?.getText() ?? '';
    for (const m of text.matchAll(PERMISSION_LITERAL)) acc.permissions.add(m[1] as string);
    for (const m of text.matchAll(/\bcore\.(fn_\w+)/g)) for (const p of sqlFunctionPermissions(m[1] as string)) acc.permissions.add(p);
    if (CONSOLE_CHECK.test(text)) acc.consoleCheck = true;
    if (DEVICE_READ.test(text)) acc.readsDevice = true;
    if (KEYED.test(text)) acc.keyed = true;
    if (TICKET_READ.test(text)) acc.readsTicket = true;
    const visit = (x: ts.Node): void => {
      if (ts.isCallExpression(x)) {
        const callee = x.expression.getText();
        const own = /^this\.(\w+)$/.exec(callee);
        const held = /^this\.(\w+)\.(\w+)$/.exec(callee);
        if (own?.[1]) reach(cls, own[1], seen, acc, depth + 1);
        else if (held?.[1] && held[2] && depth < 4) {
          const type = info.fields.get(held[1]);
          if (type) reach(type, held[2], seen, acc, depth + 1);
        }
      }
      ts.forEachChild(x, visit);
    };
    if (node.body) visit(node.body);
  };

  const out = new Map<string, RouteGate>();
  for (const cls of controllers) {
    for (const method of classes.get(cls)?.methods.keys() ?? []) {
      const acc = { permissions: new Set<string>(), consoleCheck: false, readsDevice: false, keyed: false, readsTicket: false };
      reach(cls, method, new Set(), acc, 0);
      out.set(`${cls}.${method}`, { permissions: [...acc.permissions].sort(), consoleCheck: acc.consoleCheck, readsDevice: acc.readsDevice, keyed: acc.keyed, readsTicket: acc.readsTicket });
    }
  }
  cached = out;
  return out;
}

/** Where the permission applies to one side of the route only (the seller side of chat and notifications). */
export const SELLER_SIDE_ONLY: ReadonlySet<string> = new Set([
  'GET /v1/conversations',
  'GET /v1/conversations/{id}/messages',
  'POST /v1/conversations/{id}/messages',
  'POST /v1/conversations/{id}/escalate',
  'GET /v1/notifications',
]);
/** The code check of the audience applies to another session only; revoking the caller's own session works on any surface. */
export const CONSOLE_CHECK_FOR_ANOTHER_SESSION_ONLY: ReadonlySet<string> = new Set(['DELETE /v1/auth/sessions/{id}']);

export interface DerivedGate {
  /** The permissions the route's code checks. */
  permissions: string[];
  /** The surfaces every permission the route checks is granted on, narrowed to CONSOLE by a code check of the audience. */
  admits: Surface[];
  /** A gate on the whole route: not one side of it (chat, notifications), not one case (revoking another session). */
  routeWide: boolean;
}

export const routeLabel = (r: Pick<Route, 'http' | 'path'>): string => `${r.http.toUpperCase()} ${r.path}`;

/** What the gates of one controller method admit, from its code and the permission seed. */
export function deriveGate(r: Pick<Route, 'controller' | 'handler' | 'http' | 'path'>): DerivedGate {
  const label = routeLabel(r);
  const g = scanGates().get(`${r.controller}.${r.handler}`);
  if (!g) throw new Error(`${label}: no controller method ${r.controller}.${r.handler} found in the source`);
  const surfaces = permissionSurfaces();
  let admits: Surface[] = ['MOBILE', 'CONSOLE'];
  for (const p of g.permissions) {
    const s = surfaces.get(p);
    if (!s) throw new Error(`${label} checks ${p}, which is not in the permission seed`);
    admits = admits.filter((x) => s.includes(x));
  }
  const oneCaseOnly = CONSOLE_CHECK_FOR_ANOTHER_SESSION_ONLY.has(label);
  if (g.consoleCheck && !oneCaseOnly) admits = admits.filter((x) => x === 'CONSOLE');
  const routeWide = !SELLER_SIDE_ONLY.has(label) && !oneCaseOnly && (g.permissions.length > 0 || g.consoleCheck);
  return { permissions: g.permissions, admits, routeWide };
}
