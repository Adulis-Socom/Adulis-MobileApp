export const MODES = ['buyer', 'seller', 'courier'] as const;
export type Mode = (typeof MODES)[number];

export const MODE_LABEL: Record<Mode, string> = {
  buyer: 'Buyer',
  seller: 'Seller Companion',
  courier: 'Courier',
};

/**
 * The shells this account may open. AVAILABLE modes are backend truth; the ACTIVE mode
 * (ui-store) is only which of them is on screen, and switching between them never
 * touches the session (founder decision, WO-001).
 *
 * Buyer is every account's base mode (ADU-PRD-01 S6.3, ADU-API-01 S12.2: verify creates
 * a buyer identity). Seller Companion and Courier are relationships only the backend can
 * assert, and the contract has no source for them yet (WO-001 report, gap CG-1) -- so a
 * release build offers Buyer alone. `devDiagnostics` unlocks all three in development
 * builds so the foundation shells can be exercised; it is never business truth.
 */
export function resolveAvailableModes(devDiagnostics: boolean): readonly Mode[] {
  return devDiagnostics ? MODES : ['buyer'];
}

export function useAvailableModes(): readonly Mode[] {
  return resolveAvailableModes(__DEV__);
}
