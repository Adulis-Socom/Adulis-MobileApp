import { useEffect, type RefObject } from 'react';
import { AccessibilityInfo, type HostInstance } from 'react-native';

/** Long enough for a just-mounted view to reach the screen reader's tree; short enough not to be noticed. */
export const FOCUS_DELAY_MS = 150;

/**
 * Moves screen-reader focus to `ref`'s element whenever `request` changes to a non-null value
 * (WO-018, A-006). For a control that replaced the one the Buyer pressed: a Seller tab whose list
 * was remounted, the next Delete Account step. Focusing an element reads it, so no separate
 * announcement is made for it.
 */
export function useFocusRequest(ref: RefObject<HostInstance | null>, request: string | number | null) {
  useEffect(() => {
    if (request === null) return;
    const timer = setTimeout(() => {
      if (ref.current) AccessibilityInfo.sendAccessibilityEvent(ref.current, 'focus');
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
    // The ref object is stable; only a new request moves focus.
  }, [request]);
}
