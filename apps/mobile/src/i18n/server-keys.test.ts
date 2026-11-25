import { en } from '@adulis/locale/mobile';

import { repoFile, repoFolderFiles } from '../testing/source-scan';

/**
 * Some catalogue keys are named by the server: a Seller's Trust level, a review's evidence basis, a
 * fulfilment method, a category's label. The app draws a sentence only for a key it has, so a value the
 * server adds and the catalogue lacks would vanish from the screen (or show as a bare code) with nothing
 * failing. This holds the served set against the catalogue, read from the generated contract and the
 * category migrations, both only read.
 *
 * WHAT IT COVERS: four enums of the contract (a Seller profile Trust level, a Search result Seller Trust
 * level, a review evidence basis, a Seller fulfilment method) and the category labels written by the
 * migrations in db/migrations: every migration is read, the catalogue keys any of them names are checked,
 * and the set of migrations that write the category table is pinned, so a newer migration that adds or
 * relabels a category fails here until this test has read it.
 *
 * WHAT IT DOES NOT COVER: the Seller Companion's served values (`seller.role.*` and `seller.status.*`,
 * which carry a `.other` fallback key for a value the app does not know), the
 * storefront status (`StorefrontDto.status`), any enum of the contract not listed above, and a category
 * created outside a migration (the seed folder is empty and no Console write path exists today).
 */

type Schema = { properties?: Record<string, Schema>; items?: Schema; enum?: string[] };
type Contract = { components: { schemas: Record<string, Schema> } };

const contract = JSON.parse(repoFile('contracts/openapi.json')) as Contract;

/** The values of one enum in the contract, by schema, property and (for a list) its items. */
function enumAt(schema: string, property: string, list = false): string[] {
  const field = contract.components.schemas[schema]?.properties?.[property];
  const values = (list ? field?.items : field)?.enum;
  if (!values || values.length === 0)
    throw new Error(
      `the contract has no enum at ${schema}.${property}: the schema moved, update this test`,
    );
  return values;
}

/** The catalogue keys a served set needs that the catalogue lacks. */
export const missingKeys = (
  prefix: string,
  values: readonly string[],
  catalogue: Record<string, string>,
) =>
  values
    .map((value) => `${prefix}${value}`)
    .filter((key) => !Object.prototype.hasOwnProperty.call(catalogue, key));

describe('the check itself', () => {
  it('names a served value the catalogue does not have, and passes one it does', () => {
    expect(missingKeys('buyer.seller.trust.', ['NEW', 'REBUILDING'], en)).toEqual([
      'buyer.seller.trust.REBUILDING',
    ]);
    expect(missingKeys('buyer.seller.trust.', ['NEW', 'ESTABLISHED', 'TRUSTED'], en)).toEqual([]);
    expect(() => enumAt('NoSuchSchema', 'level')).toThrow('the schema moved');
  });
});

describe('what the server can name is in the catalogue', () => {
  it.each([
    [
      'a Seller profile Trust level',
      'buyer.seller.trust.',
      () => enumAt('StorefrontStatsDto', 'level'),
    ],
    [
      'a Search result Seller Trust level',
      'buyer.seller.trust.',
      () => enumAt('SearchSellerDto', 'trust_level'),
    ],
    [
      'a review evidence basis',
      'buyer.review.basis.',
      () => enumAt('StorefrontReviewDto', 'evidence_basis'),
    ],
    [
      'a Seller fulfilment method',
      'buyer.seller.about.fulfilment.',
      () => enumAt('StorefrontDto', 'fulfilment_methods', true),
    ],
  ])('has a sentence for every %s', (_what, prefix, served) => {
    expect(served().length).toBeGreaterThan(0);
    expect(missingKeys(prefix, served(), en)).toEqual([]);
  });

  const migrations = repoFolderFiles('db/migrations', '.sql');
  /** A statement that creates, changes or removes the category table or its rows (not its availability table). */
  const WRITES_CATEGORIES =
    /(?:CREATE\s+TABLE|ALTER\s+TABLE|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+core\.category\b/i;
  /** The migrations read so far: the one that creates the table and the one that gives it labels. */
  const READ_SO_FAR = ['0007_catalogue_products_media.sql', '0062_catalogue_category_taxonomy.sql'];

  it('reads every migration, and only the two it has read write the category table', () => {
    expect(migrations.length).toBeGreaterThan(50);
    expect(
      migrations
        .filter(({ text }) => WRITES_CATEGORIES.test(text))
        .map(({ file }) => file)
        .sort(),
    ).toEqual(READ_SO_FAR);
  });

  it('has a label for every category any migration names', () => {
    const seeded = migrations.flatMap(({ text }) =>
      [...text.matchAll(/'(catalogue\.category\.[a-z_]+)'/g)].map((match) => match[1] as string),
    );
    expect(seeded.length).toBeGreaterThanOrEqual(3);
    expect(seeded.filter((key) => !Object.prototype.hasOwnProperty.call(en, key))).toEqual([]);
  });

  it('flags a category statement in a migration this test has not read', () => {
    expect(
      WRITES_CATEGORIES.test("INSERT INTO core.category (id, code) VALUES ('x', 'TOYS');"),
    ).toBe(true);
    expect(
      WRITES_CATEGORIES.test("update core.category set label_key = 'catalogue.category.toys'"),
    ).toBe(true);
    expect(
      WRITES_CATEGORIES.test(
        'INSERT INTO core.category_market_availability (category_id) VALUES (1);',
      ),
    ).toBe(false);
  });
});
