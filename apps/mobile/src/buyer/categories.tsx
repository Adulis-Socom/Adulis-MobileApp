import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ApiError, isTransient, type Category } from '../api/client';
import { useSession } from '../auth/session';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { hasMessage, useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';

/**
 * Catalogue categories for Buyer discovery (WO-010; ADU-MOB-02 v4.3 S399; ADU-CATINV-01 v3.3 S40):
 * the top-level categories the server says are enabled in the requester's Market, in the server's
 * order. Labels are locale keys, never prose from the server; nothing here invents a category, a
 * count or an order.
 */

/** The Market's enabled top-level categories; read only once a bootstrap has placed the device. */
export function useCategories(placed: boolean) {
  const { session, api } = useSession();
  const subject = session.status === 'signedIn' ? 'account' : 'guest';
  const query = useQuery({
    // The subject decides the Market (the Account's when signed in, else this device's).
    queryKey: ['categories', subject],
    queryFn: () => api.categories(),
    enabled: placed && session.status !== 'restoring',
    staleTime: 5 * 60_000,
    retry: (failures, error) => isTransient(error) && failures < 2,
  });
  const top = (query.data?.data ?? []).filter((c) => c.parent_id === null);
  return { ...query, categories: top };
}

/**
 * The chosen category falls back to All as soon as the server's list (a successful answer, the
 * empty one included) no longer offers it -- whether or not a tab row is shown (WO-010 review R6).
 */
export function useCategoryStillOffered(
  value: string | null,
  query: { isSuccess: boolean; categories: readonly Category[] },
  reset: () => void,
) {
  const offered = !query.isSuccess || value === null || query.categories.some((c) => c.code === value);
  useEffect(() => {
    if (!offered) reset();
  }, [offered, reset]);
}

/** True when the server refused a category filter (disabled or no longer in this Market). */
export const categoryRefused = (error: unknown) =>
  error instanceof ApiError && error.failure.kind === 'problem' && error.failure.problem.code === 'VALIDATION_FAILED' && error.failure.problem.slots?.path === 'category';

/** A category's label: its locale key when this catalogue has it, else its stable code. */
export const categoryLabel = (c: Pick<Category, 'label_key' | 'code'>, t: ReturnType<typeof useT>) => (hasMessage(c.label_key) ? t(c.label_key) : c.code);

/**
 * All Products, then each enabled category, as one scrollable tab row (it grows with the text
 * size instead of squeezing). A selected category the server no longer offers falls back to All.
 */
export function CategoryTabs({
  categories,
  value,
  onChange,
  failed,
  onRetry,
}: {
  categories: readonly Category[];
  value: string | null;
  onChange: (code: string | null) => void;
  /** The categories could not be read: All still works; say so, offer Try again. */
  failed?: boolean;
  onRetry?: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const tabs: Array<{ code: string | null; label: string }> = [
    { code: null, label: t('buyer.shop.all') },
    ...categories.map((c) => ({ code: c.code, label: categoryLabel(c, t) })),
  ];
  return (
    <View style={{ gap: theme.space.xs }}>
      <View accessibilityRole="tablist" accessibilityLabel={t('buyer.shop.categories')} testID="category-tabs">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.space.xs }}>
        {tabs.map((tab) => {
          const selected = tab.code === value;
          return (
            <Pressable
              key={tab.code ?? 'ALL'}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={tab.label}
              onPress={() => onChange(tab.code)}
              testID={`category-tab-${tab.code ?? 'ALL'}`}
              style={{
                minHeight: theme.touchTarget,
                paddingHorizontal: theme.space.md,
                justifyContent: 'center',
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: selected ? theme.color.accent : theme.color.border,
                backgroundColor: selected ? theme.color.surfaceMuted : theme.color.bg,
              }}
            >
              {/* Selection is said by the border, the weight and the tab state, never by colour alone. */}
              <AppText style={{ fontWeight: selected ? theme.fontWeight.semibold : undefined }}>{tab.label}</AppText>
            </Pressable>
          );
        })}
      </ScrollView>
      </View>
      {failed ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.space.sm }}>
          <AppText accessibilityRole="alert" style={{ color: theme.color.textSecondary, flexShrink: 1 }}>
            {t('buyer.shop.categories_failed')}
          </AppText>
          {onRetry ? <Button label={t('common.retry')} variant="secondary" onPress={onRetry} /> : null}
        </View>
      ) : null}
    </View>
  );
}
