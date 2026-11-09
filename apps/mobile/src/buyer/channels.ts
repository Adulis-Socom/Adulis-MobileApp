import type { MobileMessageKey } from '@adulis/locale/mobile';

/**
 * Buyer Home's launch channels, in order (ADU-MOB-02 v4.3 S11; route tree S13:
 * `(buyer)/home/{for-you,following,nearby,discounts,locally-made}`). For You is the
 * default. Each `name` is a route file under app/(buyer)/(tabs)/home/.
 */
export const CHANNELS = [
  // For You renders the real feed (WO-004A); its `coming` line is no longer shown.
  { name: 'for-you', label: 'buyer.home.channel.for_you', coming: 'buyer.home.for_you.coming' },
  { name: 'following', label: 'buyer.home.channel.following', coming: 'buyer.home.following.coming' },
  { name: 'nearby', label: 'buyer.home.channel.nearby', coming: 'buyer.home.nearby.coming' },
  { name: 'discounts', label: 'buyer.home.channel.discounts', coming: 'buyer.home.discounts.coming' },
  {
    name: 'locally-made',
    label: 'buyer.home.channel.locally_made',
    coming: 'buyer.home.locally_made.coming',
  },
] as const satisfies readonly { name: string; label: MobileMessageKey; coming: MobileMessageKey }[];

export type ChannelName = (typeof CHANNELS)[number]['name'];

export const DEFAULT_CHANNEL: ChannelName = 'for-you';
