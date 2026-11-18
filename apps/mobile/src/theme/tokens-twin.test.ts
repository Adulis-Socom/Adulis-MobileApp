import { color, colorDark, neutral, neutralDark } from '@adulis/tokens';

import { repoFile } from '../testing/source-scan';

/**
 * tokens.css is the web twin of the token values and is kept in step by hand. The control edge is
 * the one value whose twin is checked here: the ramp step it points at, in the light block and in
 * both dark blocks, and the role that points at it.
 */
const css = repoFile('packages/tokens/tokens.css');

describe('the control edge in tokens.css', () => {
  it('points the role at ramp step 400, as the TypeScript values do', () => {
    expect(color.borderStrong).toBe(neutral[400]);
    expect(colorDark.borderStrong).toBe(neutralDark[400]);
    expect(css).toContain('--adu-color-border-strong: var(--adu-neutral-400);');
  });

  it('carries the same step 400 values: one light block, then the two dark blocks', () => {
    const steps = [...css.matchAll(/--adu-neutral-400:\s*(#[0-9a-fA-F]{6});/g)].map((m) => m[1]!.toLowerCase());
    expect(steps).toEqual([neutral[400], neutralDark[400], neutralDark[400]]);
  });
});
