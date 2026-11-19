import { disabledCartAdapter } from '../adapters/disabled';
import type { CartAdapter } from '../cart/port';

export type CommerceMode = 'disabled' | 'fixture';

/**
 * What this bundle ships. The production provider reads it, so changing it is a reviewed code change and
 * never configuration, a flag or a link. There is no 'live' mode.
 */
export const SHIPPED_COMMERCE_MODE: CommerceMode = 'disabled';

/**
 * The adapter to serve. A fixture adapter is honoured only when the build allows fixtures AND this is a
 * development build; anything else is served the disabled adapter, whatever was asked for.
 */
export function resolveAdapter(args: {
  requested: CartAdapter;
  build: CommerceMode;
  dev: boolean;
}): CartAdapter {
  const { requested, build, dev } = args;
  return requested.mode === 'fixture' && !(build === 'fixture' && dev)
    ? disabledCartAdapter
    : requested;
}
