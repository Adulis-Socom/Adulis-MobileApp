import { describe, expect, it } from 'vitest';
import { isMandatoryExit, newer } from './dirty';

describe('unsaved work: never obstructs a mandatory exit', () => {
  it('lets sign-out, expiry and revocation through, and holds ordinary navigation', () => {
    for (const path of ['/sign-in', '/sign-in/verify', '/sign-in/recovery']) expect(isMandatoryExit(path)).toBe(true);
    for (const path of ['/sellers', '/s/fx_seller_alem', '/s/fx_seller_alem/products', '/sign-inn', '/become-seller']) expect(isMandatoryExit(path)).toBe(false);
  });
});

describe('a late response never overwrites newer acknowledged data', () => {
  it('keeps the newer of the two by version', () => {
    const acknowledged = { version: 7, title: 'after my save' };
    expect(newer(acknowledged, { version: 6, title: 'a slow, older read' })).toBe(acknowledged);
    const fresher = { version: 8, title: 'a genuinely newer read' };
    expect(newer(acknowledged, fresher)).toBe(fresher);
    const same = { version: 7, title: 'same version, last answer wins' };
    expect(newer(acknowledged, same)).toBe(same);
  });

  it('takes the first answer when there is none yet', () => {
    const first = { version: 1, title: 'first' };
    expect(newer(null, first)).toBe(first);
  });
});
