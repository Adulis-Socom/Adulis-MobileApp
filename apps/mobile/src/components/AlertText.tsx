import { useEffect } from 'react';
import { AccessibilityInfo, type TextProps } from 'react-native';

import { AppText } from './AppText';

type AnnouncedProps = Omit<TextProps, 'accessibilityRole' | 'children'> & {
  children: string | null | undefined;
  variant?: 'body' | 'heading';
};

/** Speaks `text` when it appears and whenever it changes. No live region as well: on Android that would read it twice. */
function useAnnouncement(text: string | null | undefined) {
  useEffect(() => {
    if (text) AccessibilityInfo.announceForAccessibility(text);
  }, [text]);
}

/**
 * A message the Buyer must hear (WO-017, A-001): a failure, a refusal, or a state that replaced
 * what was loading. The alert role alone is not spoken on Android or iOS (see TextField), so the
 * message is announced when it appears and whenever it changes.
 */
export function AlertText({ children, ...props }: AnnouncedProps) {
  useAnnouncement(children);
  if (!children) return null;
  return (
    <AppText {...props} accessibilityRole="alert">
      {children}
    </AppText>
  );
}

/**
 * A progress line the Buyer should hear without it being an alert (WO-018, A-006): "Loading
 * more", "Deleting your Account". Announced the same way as AlertText.
 */
export function StatusText({ children, ...props }: AnnouncedProps) {
  useAnnouncement(children);
  if (!children) return null;
  return <AppText {...props}>{children}</AppText>;
}
