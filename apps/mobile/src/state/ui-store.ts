import type { ColorMode } from '@adulis/tokens';
import { create } from 'zustand';

import type { Mode } from '../modes/modes';

export type ThemePreference = 'system' | ColorMode;

/**
 * Client/UI state only (WO-001 S14). Never server truth: no Orders, Products, stock,
 * payment, Trust, permissions, Seller or Courier eligibility -- those belong to the
 * backend and reach the app through TanStack Query. Not persisted.
 */
type UiState = {
  /** The shell on screen (ModeLayout; reset by clearSession). Never an entitlement. */
  activeMode: Mode | null;
  themePreference: ThemePreference;
  setActiveMode: (mode: Mode | null) => void;
  setThemePreference: (preference: ThemePreference) => void;
};

export const useUiStore = create<UiState>()((set) => ({
  activeMode: null,
  themePreference: 'system',
  setActiveMode: (activeMode) => set({ activeMode }),
  setThemePreference: (themePreference) => set({ themePreference }),
}));
