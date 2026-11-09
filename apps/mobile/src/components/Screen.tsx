import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme';
import { AppText } from './AppText';

/**
 * A scrolling, safe-area-aware screen. `edges` names the sides this screen owns: a tab
 * screen leaves the bottom to the tab bar, a screen under a header leaves the top to it.
 * `title` is the screen's heading. `centered` places short content (a placeholder) in the
 * remaining space, and still scrolls when large text makes it taller than the screen.
 */
export function Screen({
  children,
  title,
  edges = ['top', 'bottom', 'left', 'right'],
  centered = false,
}: {
  children: ReactNode;
  title?: string;
  edges?: readonly Edge[];
  centered?: boolean;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: theme.space.lg, gap: theme.space.md }}>
        {title ? (
          <AppText variant="heading" accessibilityRole="header">
            {title}
          </AppText>
        ) : null}
        <View
          style={{
            gap: theme.space.md,
            ...(centered ? { flexGrow: 1, justifyContent: 'center' } : null),
          }}
        >
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
