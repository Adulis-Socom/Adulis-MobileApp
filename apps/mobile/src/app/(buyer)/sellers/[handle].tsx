import { useLocalSearchParams } from 'expo-router';

import { SellerProfile } from '../../../buyer/SellerProfile';

/**
 * /sellers/:handle -- the Buyer Seller Profile (WO-006). ADU-MOB-02 names the route
 * `seller/[sellerRef]`; `/seller` is already the Seller Companion shell, and no Seller ref exists
 * beyond the handle, so the plural keeps the two apart (recorded for the founder with OVN-080).
 */
export default function SellerPage() {
  const { handle } = useLocalSearchParams();
  return <SellerProfile handle={handle} />;
}
