import { asVariantId, type Money, type VariantId } from '../../cart/model';

/**
 * The simulator's demonstration catalogue: two Sellers, a few Products and options, all visibly fake
 * (names start with "Demo", ids carry a fixed prefix). Nothing here is a real Product, price or stock.
 */
export type DemoSeller = Readonly<{ key: string; handle: string; storeName: string }>;

export const SELLER_A: DemoSeller = { key: 'DEMO-SELLER-A', handle: 'demo-seller-a', storeName: 'Demo Seller A' };
export const SELLER_B: DemoSeller = { key: 'DEMO-SELLER-B', handle: 'demo-seller-b', storeName: 'Demo Seller B' };

export type DemoVariant = {
  id: VariantId;
  seller: DemoSeller;
  productSlug: string;
  productName: string;
  option: string;
  priceMinor: number;
  currency: string;
  quantityAvailable: number;
  status: 'ACTIVE' | 'WITHDRAWN';
};

const id = (n: number) => asVariantId(`de000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`);

export const A_SHIRT_SMALL = id(1);
export const A_SHIRT_LARGE = id(2);
export const A_BOWL = id(3);
export const B_MUG = id(4);
export const B_LAMP = id(5);

const make = (variantId: VariantId, seller: DemoSeller, productSlug: string, productName: string, option: string, priceMinor: number, quantityAvailable = 10): DemoVariant => ({
  id: variantId,
  seller,
  productSlug,
  productName,
  option,
  priceMinor,
  currency: 'ETB',
  quantityAvailable,
  status: 'ACTIVE',
});

/** A fresh copy each time, so one test never sees another's changes. */
export function demoCatalogue(): DemoVariant[] {
  return [
    make(A_SHIRT_SMALL, SELLER_A, 'demo-shirt', 'Demo shirt', 'size=s', 120000),
    make(A_SHIRT_LARGE, SELLER_A, 'demo-shirt', 'Demo shirt', 'size=l', 130000),
    make(A_BOWL, SELLER_A, 'demo-bowl', 'Demo bowl', 'default', 45000),
    make(B_MUG, SELLER_B, 'demo-mug', 'Demo mug', 'default', 30000),
    make(B_LAMP, SELLER_B, 'demo-lamp', 'Demo lamp', 'default', 250000, 1),
  ];
}

export const moneyOf = (priceMinor: number, currency: string): Money => ({ amountMinor: priceMinor, currency });
