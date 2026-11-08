import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme';

/** Safe-area aware, themed and scrollable, so long or tall (Amharic) content is never clipped. */
export function Screen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.md }}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
