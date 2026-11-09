import type { ColorMode } from '@adulis/tokens';
import { create } from 'zustand';

import type { Mode } from '../modes/modes';

export type ThemePreference = 'system' | ColorMode;
export type Locale = 'en' | 'am';

/**
 * Client/UI state only (WO-001 S14). Never server truth: no Orders, Products, stock,
 * payment, Trust, permissions, Seller or Courier eligibility -- those belong to the
 * backend and reach the app through TanStack Query. Not persisted.
 */
type UiState = {
  /** The shell on screen (ModeLayout; reset by clearSession). Never an entitlement. */
  activeMode: Mode | null;
  themePreference: ThemePreference;
  /** The one locale selection point; device-locale detection, when it comes, calls setLocale. */
  locale: Locale;
  /** The UPGRADE_RECOMMENDED notice was dismissed for this app run (not persisted). */
  upgradeNoticeDismissed: boolean;
  setActiveMode: (mode: Mode | null) => void;
  setThemePreference: (preference: ThemePreference) => void;
  setLocale: (locale: Locale) => void;
  dismissUpgradeNotice: () => void;
};

export const useUiStore = create<UiState>()((set) => ({
  activeMode: null,
  themePreference: 'system',
  locale: 'en',
  upgradeNoticeDismissed: false,
  setActiveMode: (activeMode) => set({ activeMode }),
  setThemePreference: (themePreference) => set({ themePreference }),
  setLocale: (locale) => set({ locale }),
  dismissUpgradeNotice: () => set({ upgradeNoticeDismissed: true }),
}));
