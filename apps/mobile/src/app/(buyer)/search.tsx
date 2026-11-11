import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { SearchType } from '../../api/client';
import { SearchResults } from '../../buyer/SearchResults';
import { AppText } from '../../components/AppText';
import { useT } from '../../i18n/i18n';
import { useTheme } from '../../theme/theme';

/** The server's own minimum (2 characters after normalisation): shorter is never sent. */
const MIN_LENGTH = 2;
/** Typing settles for this long before a query is sent; Search submits at once. */
const DEBOUNCE_MS = 350;
const TABS: ReadonlyArray<{ type: SearchType; label: 'buyer.search.tab.top' | 'buyer.search.tab.products' | 'buyer.search.tab.scenes' | 'buyer.search.tab.sellers' }> = [
  { type: 'TOP', label: 'buyer.search.tab.top' },
  { type: 'PRODUCT_POST', label: 'buyer.search.tab.products' },
  { type: 'SCENE_POST', label: 'buyer.search.tab.scenes' },
  { type: 'SELLER', label: 'buyer.search.tab.sellers' },
];

/** Whitespace as the server folds it; Unicode normalisation is the server's (NFKC). */
const tidy = (s: string) => s.replace(/\s+/gu, ' ').trim();

/**
 * Marketplace Search (ADU-MOB-02 v4.3 S33; ADU-SRC-01 v3.2; WO-008): Products, Sellers and Scenes
 * of the Buyer's Market, Top | Products | Scenes | Sellers. Real public results only: no
 * suggestions, popular or recent queries (none is approved), and nothing about a query is stored
 * on the device or sent anywhere but GET /v1/search. A result opens its existing screen; this
 * screen stays mounted under it, so Back returns to the same query, tab and place.
 */
export default function Search() {
  const t = useT();
  const theme = useTheme();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SearchType>('TOP');

  useEffect(() => {
    const next = tidy(text);
    const timer = setTimeout(() => setQuery(next), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const submit = () => {
    setQuery(tidy(text));
    Keyboard.dismiss();
  };
  const clear = () => {
    setText('');
    setQuery('');
    input.current?.focus();
  };
  const tooShort = query.length > 0 && [...query].length < MIN_LENGTH;

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <View style={{ padding: theme.space.sm, gap: theme.space.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.color.border,
            borderRadius: theme.radius.md,
            backgroundColor: theme.color.surface,
            paddingHorizontal: theme.space.sm,
          }}
        >
          <Ionicons name="search-outline" size={theme.fontSize.lg} color={theme.color.textSecondary} importantForAccessibility="no" accessibilityElementsHidden />
          <TextInput
            ref={input}
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            autoFocus
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            maxLength={100}
            placeholder={t('buyer.search.input')}
            placeholderTextColor={theme.color.textSecondary}
            accessibilityLabel={t('buyer.search.input')}
            testID="search-input"
            style={{ flex: 1, minHeight: theme.touchTarget, color: theme.color.text, fontSize: theme.fontSize.base, paddingHorizontal: theme.space.sm }}
          />
          {text.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('buyer.search.clear')}
              onPress={clear}
              hitSlop={8}
              style={{ minWidth: theme.touchTarget, minHeight: theme.touchTarget, alignItems: 'center', justifyContent: 'center' }}
              testID="search-clear"
            >
              <Ionicons name="close-circle" size={theme.fontSize.lg} color={theme.color.textSecondary} importantForAccessibility="no" accessibilityElementsHidden />
            </Pressable>
          ) : null}
        </View>
        <View accessibilityRole="tablist" accessibilityLabel={t('buyer.search.tabs')} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: theme.color.border }}>
          {TABS.map(({ type, label }) => {
            const selected = type === tab;
            return (
              <Pressable
                key={type}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setTab(type)}
                testID={`search-tab-${type}`}
                style={{
                  flex: 1,
                  minHeight: theme.touchTarget,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottomWidth: 2,
                  borderColor: selected ? theme.color.accent : 'transparent',
                }}
              >
                <AppText style={{ textAlign: 'center', fontWeight: selected ? theme.fontWeight.semibold : undefined }}>{t(label)}</AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
      {query.length === 0 ? (
        <AppText style={{ padding: theme.space.lg, textAlign: 'center', color: theme.color.textSecondary }}>{t('buyer.search.hint')}</AppText>
      ) : tooShort ? (
        <AppText accessibilityLiveRegion="polite" style={{ padding: theme.space.lg, textAlign: 'center', color: theme.color.textSecondary }}>
          {t('buyer.search.too_short')}
        </AppText>
      ) : (
        <View style={{ flex: 1 }}>
          <SearchResults key={`${tab}|${query}`} query={query} tab={tab} />
        </View>
      )}
    </SafeAreaView>
  );
}
