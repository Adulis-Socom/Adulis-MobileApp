import { describe, expect, it } from 'vitest';
import { isMandatoryExit } from './dirty';

describe('unsaved work: never obstructs a mandatory exit', () => {
  it('lets sign-out, expiry and revocation through, and holds ordinary navigation', () => {
    for (const path of ['/sign-in', '/sign-in/verify', '/sign-in/recovery']) expect(isMandatoryExit(path)).toBe(true);
    for (const path of ['/sellers', '/s/fx_seller_alem', '/s/fx_seller_alem/products', '/sign-inn', '/become-seller']) expect(isMandatoryExit(path)).toBe(false);
  });
});
