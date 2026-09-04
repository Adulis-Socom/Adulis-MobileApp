import { assertNodeEnv, nodeEnv, resetNodeEnvForTests, NODE_ENVS } from '../src/common/env';
import { assertFakeIsPermitted } from '../src/common/adapters/fake-guard';
import { FakeSmsAdapter } from '../src/modules/auth/sms.adapter';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Writable } from 'node:stream';
import pino from 'pino';
import { NEVER_LOG, applyAllowList } from '../src/common/logging';

/** Any uuid: the adapter records the message and never reads this. */
const SOME_MARKET = '00000000-0000-4000-8000-000000000001';

/**
 * T8 Phase 1 / ADU-RUL-03 S1.2 -- NODE_ENV is asserted at a boundary.
 *
 * The defect these tests exist for: nothing in this repository sets
 * NODE_ENV=production (no ops/render.yaml -- D-80), so every
 * `NODE_ENV === 'production'` guard was a no-op, INCLUDING T7 S3.2's rule
 * that a fake adapter must refuse to run in production. The rule was true as
 * written and false in effect. What follows makes the refusal provable.
 */
describe('the NODE_ENV boundary (ADU-RUL-03 S1.2)', () => {
  const real = process.env['NODE_ENV'];

  beforeEach(() => {
    resetNodeEnvForTests();
  });

  afterEach(() => {
    if (real === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = real;
    resetNodeEnvForTests();
  });

  it('refuses an UNSET environment rather than choosing the permissive branch', () => {
    delete process.env['NODE_ENV'];
    // The whole finding in one assertion: unset used to mean "not production",
    // which meant every production guard was off and the permissive branch --
    // printing OTP codes -- was the default.
    expect(() => assertNodeEnv()).toThrow(/NODE_ENV is not set/);
  });

  it('refuses an UNRECOGNISED environment for the same reason', () => {
    /*
     * THE EXAMPLE USED TO BE 'staging', AND THAT IS WHY THIS COMMENT EXISTS.
     *
     * T23 Phase 4 put `staging` IN the closed set, and this test went red on
     * the first run -- correctly, having been written to catch exactly the
     * change that was made. The value below is one that will never be an
     * environment, so the assertion is about the CLOSED SET and not about
     * which four values happen to be in it today.
     */
    process.env['NODE_ENV'] = 'prod';
    expect(() => assertNodeEnv()).toThrow(/not one of/);
  });

  it('accepts exactly the closed set, and nothing else', () => {
    for (const e of NODE_ENVS) {
      resetNodeEnvForTests();
      process.env['NODE_ENV'] = e;
      expect(assertNodeEnv()).toBe(e);
    }
  });

  it('memoises: the value cannot change under a running process', () => {
    process.env['NODE_ENV'] = 'test';
    expect(nodeEnv()).toBe('test');
    process.env['NODE_ENV'] = 'production';
    // Consulted at a call site this would now read production; asserted at a
    // boundary it does not, which is the difference the ruling names.
    expect(nodeEnv()).toBe('test');
  });

  it('the fake-adapter refusal is now PROVABLE, which it was not before', () => {
    process.env['NODE_ENV'] = 'production';
    expect(() => assertFakeIsPermitted('FakeSmsAdapter')).toThrow(/cannot run in production/i);
  });

  it('and a fake cannot slip through on an unset environment', () => {
    delete process.env['NODE_ENV'];
    // Before the boundary existed this returned silently: unset !== production.
    expect(() => assertFakeIsPermitted('FakeSmsAdapter')).toThrow(/NODE_ENV is not set/);
  });

  /*
   * ---------------------------------------------------------------------
   * T23 PHASE 4 -- WHAT ADDING A VALUE TO THE CLOSED SET ACTUALLY DID.
   *
   * `staging` joined NODE_ENVS, and the danger of that is not the value: it
   * is that EVERY GUARD ASKING `=== 'production'` TAKES ITS PERMISSIVE
   * BRANCH for a new value, silently, on the day it is added. env.ts carries
   * the written audit. These are the two entries of it that a comment cannot
   * keep true.
   * ---------------------------------------------------------------------
   */

  it('staging PERMITS a fake, deliberately, and production still refuses one', () => {
    process.env['NODE_ENV'] = 'staging';
    // Not an oversight. There is no SMS vendor (O-5b is open), so a staging
    // that refused fakes could not sign anyone in -- which is a staging
    // server nobody can use.
    expect(() => assertFakeIsPermitted('FakeSmsAdapter')).not.toThrow();

    resetNodeEnvForTests();
    process.env['NODE_ENV'] = 'production';
    // And the refusal that matters is untouched by the new value.
    expect(() => assertFakeIsPermitted('FakeSmsAdapter')).toThrow(/cannot run in production/i);
  });

  it('the code goes to a FILE on staging', () => {
    process.env['NODE_ENV'] = 'staging';
    const logPath = path.join(mkdtempSync(path.join(tmpdir(), 'adulis-sms-')), 'sms.log');
    process.env['DEV_SMS_LOG'] = logPath;
    try {
      const adapter = new FakeSmsAdapter();
      void adapter.send({
        phone: '+251900000001',
        templateKey: 'otp.sign_in',
        slots: { code: '424242' },
        marketId: SOME_MARKET,
      } as never);
      expect(readFileSync(logPath, 'utf8')).toContain('424242');
    } finally {
      delete process.env['DEV_SMS_LOG'];
    }
  });

  /*
   * AND NEVER TO THE LOGGER -- ASSERTED ON THE SOURCE, AND HERE IS WHY.
   *
   * The obvious test is to capture stdout and search it for the code. THAT
   * TEST WAS WRITTEN FIRST AND IT PASSED WITH THE VIOLATION PLANTED, which is
   * the only reason this comment exists: pino writes through SonicBoom
   * straight to file descriptor 1 and never touches `process.stdout.write`,
   * so the capture was blind and the green was meaningless.
   *
   * The next instinct is to lean on redaction. IT DOES NOT COVER THIS CASE.
   * `NEVER_LOG` removes FIELDS -- `otpCode`, `phone` -- and `applyAllowList`
   * drops unknown keys outright, but `msg` is allow-listed and NOTHING READS
   * ITS CONTENTS. `log.warn({ msg: \`code ${code}\` })` passes every control
   * this repository has. The field-level guarantee is real and it is not the
   * guarantee needed here.
   *
   * So the assertion is on the source: the send path contains no logger call
   * at all. That is a weaker instrument than a behavioural one and it is
   * stated as such -- but it is an instrument that FIRES, which the two
   * stronger-looking ones were not.
   */
  it('and the send path never calls the logger at all', () => {
    const src = readFileSync(
      path.join(__dirname, '..', 'src', 'modules', 'auth', 'sms.adapter.ts'),
      'utf8',
    );
    // From the CLASS, not the interface -- the first match in the file is the
    // `SmsAdapter` declaration, and slicing there reads the whole module.
    const cls = src.slice(src.indexOf('export class FakeSmsAdapter'));
    const send = cls.slice(cls.indexOf('send(message: SmsMessage)'));
    const body = send.slice(0, send.indexOf('\n  }'));
    expect(body).not.toMatch(/\blog\.(warn|info|error|debug|trace|fatal)\b/);
  });

  it('the field-level redaction is real, and this is exactly how far it goes', () => {
    /*
     * Both halves in one test, because either alone misleads. A STRUCTURED
     * field named on NEVER_LOG is removed; the SAME value interpolated into
     * `msg` is not. Anyone reaching for "the logger redacts it" as a reason
     * to log a secret should read the second expectation.
     */
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _enc, cb) {
        lines.push(String(chunk));
        cb();
      },
    });
    const logger = pino(
      {
        level: 'info',
        redact: { paths: [...NEVER_LOG], remove: true },
        formatters: { log: applyAllowList },
      },
      sink,
    );
    logger.warn({ msg: 'a message', phone: '+251900000001', otpCode: '424242' });
    logger.warn({ msg: 'the code is 424242' });
    const out = lines.join('');
    expect(out).not.toContain('+251900000001');
    expect(out).toContain('a message');
    // NOT a bug being asserted as correct -- a LIMIT being written down.
    expect(out).toContain('the code is 424242');
  });
});
