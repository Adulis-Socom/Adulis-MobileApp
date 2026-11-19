import { en } from '@adulis/locale/mobile';

import { repoFile } from '../testing/source-scan';

/**
 * Some catalogue keys are named by the server: a Seller's Trust level, a review's evidence basis, a
 * fulfilment method, a category's label. The app draws a sentence only for a key it has, so a value the
 * server adds and the catalogue lacks would vanish from the screen (or show as a bare code) with nothing
 * failing. This holds the served set against the catalogue, read from the generated contract and the
 * category migration, both only read.
 */

type Schema = { properties?: Record<string, Schema>; items?: Schema; enum?: string[] };
type Contract = { components: { schemas: Record<string, Schema> } };

const contract = JSON.parse(repoFile('contracts/openapi.json')) as Contract;

/** The values of one enum in the contract, by schema, property and (for a list) its items. */
function enumAt(schema: string, property: string, list = false): string[] {
  const field = contract.components.schemas[schema]?.properties?.[property];
  const values = (list ? field?.items : field)?.enum;
  if (!values || values.length === 0) throw new Error(`the contract has no enum at ${schema}.${property}: the schema moved, update this test`);
  return values;
}

/** The catalogue keys a served set needs that the catalogue lacks. */
export const missingKeys = (prefix: string, values: readonly string[], catalogue: Record<string, string>) =>
  values.map((value) => `${prefix}${value}`).filter((key) => !Object.prototype.hasOwnProperty.call(catalogue, key));

describe('the check itself', () => {
  it('names a served value the catalogue does not have, and passes one it does', () => {
    expect(missingKeys('buyer.seller.trust.', ['NEW', 'REBUILDING'], en)).toEqual(['buyer.seller.trust.REBUILDING']);
    expect(missingKeys('buyer.seller.trust.', ['NEW', 'ESTABLISHED', 'TRUSTED'], en)).toEqual([]);
    expect(() => enumAt('NoSuchSchema', 'level')).toThrow('the schema moved');
  });
});

describe('what the server can name is in the catalogue', () => {
  it.each([
    ['a Seller profile Trust level', 'buyer.seller.trust.', () => enumAt('StorefrontStatsDto', 'level')],
    ['a Search result Seller Trust level', 'buyer.seller.trust.', () => enumAt('SearchSellerDto', 'trust_level')],
    ['a review evidence basis', 'buyer.review.basis.', () => enumAt('StorefrontReviewDto', 'evidence_basis')],
    ['a Seller fulfilment method', 'buyer.seller.about.fulfilment.', () => enumAt('StorefrontDto', 'fulfilment_methods', true)],
  ])('has a sentence for every %s', (_what, prefix, served) => {
    expect(served().length).toBeGreaterThan(0);
    expect(missingKeys(prefix, served(), en)).toEqual([]);
  });

  it('has a label for every category the migration seeds', () => {
    const migration = repoFile('db/migrations/0062_catalogue_category_taxonomy.sql');
    const seeded = [...migration.matchAll(/'(catalogue\.category\.[a-z_]+)'/g)].map((match) => match[1] as string);
    expect(seeded.length).toBeGreaterThanOrEqual(3);
    expect(seeded.filter((key) => !Object.prototype.hasOwnProperty.call(en, key))).toEqual([]);
  });
});
