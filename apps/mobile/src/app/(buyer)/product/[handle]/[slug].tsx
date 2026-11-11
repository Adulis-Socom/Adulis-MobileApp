import { useLocalSearchParams } from 'expo-router';

import { ProductDetail } from '../../../../buyer/ProductDetail';

/**
 * /product/:handle/:slug -- how the public read addresses a Product (WO-005). `from` is the
 * Scene it was opened from (WO-009 provenance): untrusted, and recorded only if the server
 * finds that Scene tags this Product now.
 */
export default function ProductPage() {
  const { handle, slug, from } = useLocalSearchParams();
  return <ProductDetail handle={handle} slug={slug} from={from} />;
}
