import type { components } from '@adulis/api-client';

type Product = components['schemas']['StorefrontProductDto'];

export const productVariant = (id: string, available = true): Product['variants'][number] => ({
  id,
  variant_key: 'size=m',
  price_minor: 1000,
  price_currency: 'ETB',
  stock_count: 5,
  stock_confirmed_at: null,
  status: 'ACTIVE',
  available,
});

/** The public Product answer for the demonstration Product the builders' lines name. */
export const product = (
  variants: Product['variants'],
  over: Partial<Pick<Product, 'slug' | 'available'>> & { handle?: string } = {},
): Product => ({
  id: 'de000000-0000-4000-8000-0000000000aa',
  slug: over.slug ?? 'demo-item',
  name: 'Demo item',
  base_price_minor: 1000,
  base_price_currency: 'ETB',
  price_min_minor: 1000,
  price_max_minor: 1000,
  price_currency: 'ETB',
  available: over.available ?? true,
  description: null,
  category_id: null,
  seller: { handle: over.handle ?? 'demo-seller', store_name: 'Demo Seller' },
  variants,
  attributes: [],
  images: [],
});
