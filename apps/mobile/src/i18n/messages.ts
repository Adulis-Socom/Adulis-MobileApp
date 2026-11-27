// English-first. The app takes strings from @adulis/locale/mobile ONLY (check-locale-imports.mjs and ESLint hold it).
// Amharic exists in the package but is gated: it is not enabled here until human review releases it.
import { en, type MobileMessageKey } from '@adulis/locale/mobile';

export type { MobileMessageKey };

export function t(key: MobileMessageKey): string {
  return en[key];
}
