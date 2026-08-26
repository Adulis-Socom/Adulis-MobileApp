/**
 * Shared helpers for the ADU-DB-01 v1.9 Appendix C check harness.
 *
 * Appendix C describes sixteen checks "a reviewer can run against generated DDL
 * without reading it line by line". Each guards an invariant enforced by an
 * ABSENCE — the failure mode where an agent "completes" the schema and silently
 * removes a guarantee. Nothing here raises on its own; that is the point.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PASS = 'PASS';
export const FAIL = 'FAIL';
export const PENDING = 'PENDING';

const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.resolve(here, '..', 'migrations');
export const CHECKS_DIR = here;

/**
 * Remove SQL comments, leaving string and dollar-quoted bodies intact.
 *
 * WHY THIS EXISTS. Appendix C's checks are written as raw greps, and a raw grep
 * over migration text cannot tell DDL from a comment about DDL. Migration 8 will
 * carry a comment reading "never a MATERIALIZED VIEW" (R16, section 8.3); a
 * literal grep fails on the sentence that exists to prevent the thing. Appendix C
 * says the checks run "against generated DDL", so comments are removed and
 * everything executable is kept.
 *
 * Dollar-quoted bodies are PRESERVED, not stripped: a plpgsql function body is
 * executable SQL, and dynamic DDL hidden inside one is exactly what these checks
 * should still catch.
 */
export function stripSqlComments(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const two = text.slice(i, i + 2);
    // line comment
    if (two === '--') {
      while (i < n && text[i] !== '\n') i += 1;
      continue;
    }
    // block comment (nesting is legal in PostgreSQL)
    if (two === '/*') {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (text.slice(i, i + 2) === '/*') {
          depth += 1;
          i += 2;
        } else if (text.slice(i, i + 2) === '*/') {
          depth -= 1;
          i += 2;
        } else i += 1;
      }
      out += ' ';
      continue;
    }
    // single-quoted literal
    if (text[i] === "'") {
      out += text[i];
      i += 1;
      while (i < n) {
        if (text[i] === "'" && text[i + 1] === "'") {
          out += "''";
          i += 2;
          continue;
        }
        out += text[i];
        if (text[i] === "'") {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    // dollar-quoted body: $tag$ ... $tag$
    const dollar = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(text.slice(i));
    if (dollar) {
      const tag = dollar[0];
      const end = text.indexOf(tag, i + tag.length);
      const stop = end === -1 ? n : end + tag.length;
      out += text.slice(i, stop);
      i = stop;
      continue;
    }
    out += text[i];
    i += 1;
  }
  return out;
}

/** Every migration file, with comments removed. Empty at Tier 0. */
export async function loadMigrations() {
  let files = [];
  try {
    files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  } catch {
    return [];
  }
  const out = [];
  for (const file of files) {
    const raw = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    out.push({ file, raw, ddl: stripSqlComments(raw) });
  }
  return out;
}

/** Matches of `re` across all migration DDL, as "file:line — text". */
export function grepMigrations(migrations, re) {
  const hits = [];
  for (const m of migrations) {
    const lines = m.ddl.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
      if (new RegExp(re.source, flags.replace('g', '')).test(lines[i])) {
        hits.push(`${m.file}:${i + 1} — ${lines[i].trim().slice(0, 90)}`);
      }
    }
  }
  return hits;
}

/**
 * Every `CREATE TABLE <schema>.<name> ( ... )` block, so a check can ask
 * "does any table in schema `core` carry this column" without a grep that
 * cannot tell one schema's DDL from another's.
 */
export function createTableBlocks(migrations) {
  const blocks = [];
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("?[a-z_]+"?)\.("?[a-z_]+"?)\s*\(/gi;
  for (const m of migrations) {
    let match;
    while ((match = re.exec(m.ddl)) !== null) {
      // walk to the matching close paren
      let depth = 1;
      let i = re.lastIndex;
      while (i < m.ddl.length && depth > 0) {
        if (m.ddl[i] === '(') depth += 1;
        else if (m.ddl[i] === ')') depth -= 1;
        i += 1;
      }
      blocks.push({
        file: m.file,
        schema: match[1].replace(/"/g, ''),
        table: match[2].replace(/"/g, ''),
        body: m.ddl.slice(re.lastIndex, i - 1),
      });
    }
  }
  return blocks;
}

export const ok = (detail) => ({ state: PASS, detail });
export const bad = (detail) => ({ state: FAIL, detail });
