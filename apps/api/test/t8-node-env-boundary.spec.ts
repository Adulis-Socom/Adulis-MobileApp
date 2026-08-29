import { assertNodeEnv, nodeEnv, resetNodeEnvForTests, NODE_ENVS } from '../src/common/env';
import { assertFakeIsPermitted } from '../src/common/adapters/fake-guard';

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
    process.env['NODE_ENV'] = 'staging';
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
});
