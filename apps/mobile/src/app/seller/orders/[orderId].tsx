import { useLocalSearchParams } from 'expo-router';

import { SellerOrderDetail } from '../../../seller/SellerOrders';

/** The route parameter is untrusted: the screen accepts only an Order id shape. */
export default function SellerOrderRoute() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  return <SellerOrderDetail orderId={orderId} />;
}
