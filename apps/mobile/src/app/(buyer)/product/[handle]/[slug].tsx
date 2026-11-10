import { useLocalSearchParams } from 'expo-router';

import { ProductDetail } from '../../../../buyer/ProductDetail';

/** /product/:handle/:slug -- how the public read addresses a Product (WO-005). */
export default function ProductPage() {
  const { handle, slug } = useLocalSearchParams();
  return <ProductDetail handle={handle} slug={slug} />;
}
