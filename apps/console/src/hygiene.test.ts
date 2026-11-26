import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { en } from '@adulis/locale';
import { describe, expect, it } from 'vitest';
import { statusOf } from './features/readiness/status';
import { problemText } from './features/problem';
import { looksLikePhone, safeReturnPath } from './features/auth/flow';
import { TransportError, type ProblemCode } from './transport/port';

const src = path.resolve(import.meta.dirname);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
const strip = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const shipped = walk(src).filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\.ts$/.test(f) && !f.includes(`${path.sep}fixtures${path.sep}`));

describe('source hygiene (what no screen may contain)', () => {
  it('has no colour literal outside the tokens, in any shipped TSX, TS or CSS', () => {
    const offenders = shipped.filter((f) => /#[0-9a-fA-F]{3,8}\b/.test(strip(readFileSync(f, 'utf8')).replace(/href=\{?[`"']#[\w${}.]+/g, '')));
    expect(offenders.map((f) => path.relative(src, f))).toEqual([]);
  });

  it('uses no web storage, no cookie access and no legacy theme', () => {
    const offenders = shipped.filter((f) => /localStorage|sessionStorage|document\.cookie|prefers-color-scheme|data-theme/.test(strip(readFileSync(f, 'utf8'))));
    expect(offenders.map((f) => path.relative(src, f))).toEqual([]);
  });

  it('never imports the fixtures except through the one build-time door', () => {
    const offenders = shipped.filter((f) => !f.endsWith(path.join('transport', 'select.ts')) && /from ['"][./]*\/fixtures['"/]|import\(['"][./]*\/fixtures/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => path.relative(src, f))).toEqual([]);
  });

  it('console copy mentions no revenue, payout, Reservation, refund or surcharge, and Orders/payments only to say they are absent', () => {
    const copy = Object.entries(en);
    expect(copy.filter(([, v]) => /revenue|gmv|payout|reservation|refund|surcharge|paid order/i.test(v)).map(([k]) => k)).toEqual([]);
    const negations = new Set(['home.honest_body']);
    expect(copy.filter(([k, v]) => /\b(orders?|payments?|deliver\w*)\b/i.test(v) && !negations.has(k)).map(([k]) => k)).toEqual([]);
  });
});

describe('small pure behaviours the screens rely on', () => {
  it('maps readiness items to a status without deciding anything', () => {
    const base = { code: 'X', satisfied: false, workflow_state: null, reason_codes: [], resolving_action: null } as const;
    expect(statusOf({ ...base, satisfied: true })).toBe('done');
    expect(statusOf({ ...base, workflow_state: 'WAITING_FOR_DM_REVIEW' })).toBe('waiting');
    expect(statusOf({ ...base, resolving_action: { kind: 'ADD_PRODUCT', denied: 'NO_PERMISSION' } })).toBe('blocked');
    expect(statusOf({ ...base, resolving_action: { kind: 'ADD_PRODUCT', denied: null } })).toBe('todo');
  });

  it('every problem code reads as a sentence, and a rate limit shows the SERVER time', () => {
    const codes: ProblemCode[] = ['AUTHENTICATION_REQUIRED', 'PERMISSION_DENIED', 'VALIDATION_FAILED', 'NOT_FOUND', 'OTP_INVALID', 'OTP_EXPIRED', 'RATE_LIMITED', 'UNAVAILABLE', 'NETWORK', 'INTERNAL', 'CONTEXT_MISMATCH', 'CONFLICT', 'REFUSED'];
    for (const code of codes) expect(problemText(new TransportError(code)).length).toBeGreaterThan(5);
    expect(problemText(new TransportError('RATE_LIMITED', { retryAt: '2026-11-25T09:00:30.000Z' }))).toMatch(/try again at/);
    expect(problemText(new TransportError('RATE_LIMITED'))).toMatch(/wait/);
  });

  it('accepts only in-app return paths and plausible phone numbers', () => {
    expect(safeReturnPath('/s/fx_seller_alem')).toBe('/s/fx_seller_alem');
    expect(safeReturnPath('//evil.example')).toBeNull();
    expect(safeReturnPath('https://evil.example')).toBeNull();
    expect(safeReturnPath(undefined)).toBeNull();
    expect(looksLikePhone('+251 911 00 00 00')).toBe(true);
    expect(looksLikePhone('12345')).toBe(false);
    expect(looksLikePhone('call me')).toBe(false);
  });
});
