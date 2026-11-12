import { useEffect } from 'react';
import { AccessibilityInfo, type TextProps } from 'react-native';

import { AppText } from './AppText';

/**
 * A message the Buyer must hear (WO-017, A-001): a failure, a refusal, or a state that replaced
 * what was loading. The alert role alone is not spoken on Android or iOS (see TextField), so the
 * message is announced when it appears and whenever it changes. No live region as well: on Android
 * that would read it twice.
 */
export function AlertText({
  children,
  ...props
}: Omit<TextProps, 'accessibilityRole' | 'children'> & { children: string | null | undefined; variant?: 'body' | 'heading' }) {
  useEffect(() => {
    if (children) AccessibilityInfo.announceForAccessibility(children);
  }, [children]);
  if (!children) return null;
  return (
    <AppText {...props} accessibilityRole="alert">
      {children}
    </AppText>
  );
}
