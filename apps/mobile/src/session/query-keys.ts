// TanStack Query key roots (MOB-FE-01 s7). A private key MUST come from here: `acct` keys carry the Account ref, so a late
// write that escaped the stamp check would land in a namespace that no longer renders. purgePrivateQueries removes every
// root except `public`.
import type { AccountRef, DeviceId, SellerRef } from '../contracts/gap-mob-session';

export const queryKeys = {
  public: (...parts: readonly string[]) => ['public', ...parts] as const,
  guest: (deviceId: DeviceId, ...parts: readonly string[]) => ['guest', deviceId, ...parts] as const,
  account: (accountRef: AccountRef, ...parts: readonly string[]) => ['acct', accountRef, ...parts] as const,
  companion: (accountRef: AccountRef, sellerRef: SellerRef, ...parts: readonly string[]) => ['acct', accountRef, 'seller', sellerRef, ...parts] as const,
  courier: (accountRef: AccountRef, ...parts: readonly string[]) => ['acct', accountRef, 'courier', ...parts] as const,
};
