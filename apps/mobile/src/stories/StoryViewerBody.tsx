// The Story viewer's behaviour, without the router (so it is tested with a controlled clock and controlled reads).
//
// Presentation gate (M01-R07): nothing is drawn from a read that finished BEFORE this opening; a cached answer waits for the
// fresh one. Expiry boundary (M01-R05): at a Story's known server expiry its photo, text and link are hidden at once, a fresh read
// is asked for, and the hide holds for this opening whatever any later read (pending, failed, offline or even contradictory)
// says. A Story whose expiry has already passed on arrival is never drawn. Expiry is never extended. Movement is only ever the
// person's: Next, Previous and Close are real controls and nothing advances by itself.
import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { StoryTarget, StoryView } from '../contracts/gap-mob-stories';
import type { SellerSummary } from '../contracts/gap-mob-discovery';
import { problemKind } from '../discovery/hooks';
import { t } from '../i18n/messages';
import { Button, StateView } from '../ui/components';
import { theme } from '../ui/theme';
import { StoryCard } from './StoryCard';
import { beforeExpiry, msUntilReread, step, timeLeft } from './viewer-state';

export interface StoryRead {
  readonly status: 'pending' | 'error' | 'success';
  readonly data: { readonly seller: SellerSummary; readonly stories: readonly StoryView[] } | undefined;
  readonly error: unknown;
  /** When the answer on hand was received (0 when none). */
  readonly dataUpdatedAt: number;
  readonly refetch: () => unknown;
}

export interface StoryViewerBodyProps {
  readonly read: StoryRead;
  /** When this viewer was opened: the gate accepts only answers received at or after it. */
  readonly openedAt: number;
  readonly now?: () => number;
  readonly onClose: () => void;
  readonly onOpenTarget: (target: StoryTarget) => void;
}

const TICK_MS = 60_000; // time left is shown in hours, so a minute is precise enough

export function StoryViewerBody({ read, openedAt, now = Date.now, onClose, onOpenTarget }: StoryViewerBodyProps) {
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [, setTick] = useState(0);
  const { refetch } = read;

  const fresh = read.status === 'success' && read.data !== undefined && read.dataUpdatedAt >= openedAt;
  const stories = fresh ? read.data?.stories ?? [] : [];
  const position = Math.min(index, Math.max(0, stories.length - 1));
  const current = stories[position];
  const shown = current !== undefined && !hidden.has(current.storyRef) && beforeExpiry(current.expiresAt, now());

  // The known expiry of the Story on screen: hide it at that moment, say so once, and ask the server again.
  const currentRef = current?.storyRef;
  const currentExpiry = current?.expiresAt;
  useEffect(() => {
    if (currentRef === undefined || currentExpiry === undefined) return undefined;
    const ms = msUntilReread(currentExpiry, now());
    if (ms === null) return undefined;
    const timer = setTimeout(() => {
      setHidden((prev) => new Set(prev).add(currentRef));
      AccessibilityInfo.announceForAccessibility(t('mobile.stories.gone'));
      void refetch();
    }, ms);
    return () => clearTimeout(timer);
  }, [currentRef, currentExpiry, now, refetch]);

  // Time left moves on, and a return from the background re-checks at once (timers do not run while the app is suspended).
  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), TICK_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setTick((n) => n + 1);
      void refetch();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [refetch]);

  if (read.status === 'error' && problemKind(read.error) === 'gone') return <StateView kind="not-found" message={t('mobile.stories.gone')} action={{ label: t('mobile.stories.close'), onPress: onClose }} />;
  if (!fresh) {
    if (read.status === 'error') return <StateView kind={problemKind(read.error) === 'offline' ? 'offline' : 'error'} onRetry={() => void refetch()} action={{ label: t('mobile.stories.close'), onPress: onClose }} />;
    return <StateView kind="loading" />;
  }
  const anyShowable = stories.some((s) => !hidden.has(s.storyRef) && beforeExpiry(s.expiresAt, now()));
  if (current === undefined || !anyShowable) return <StateView kind="not-found" message={t('mobile.stories.gone')} action={{ label: t('mobile.stories.close'), onPress: onClose }} />;

  const left = shown ? timeLeft(current.expiresAt, now()) : null;
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View accessible accessibilityLiveRegion="polite">
        <Text accessibilityRole="header" style={styles.position}>
          {t('mobile.stories.position', { n: position + 1, total: stories.length })}
        </Text>
        {left ? <Text style={styles.left}>{left.key === 'mobile.stories.time_left.hours' ? t(left.key, { hours: left.hours }) : t(left.key)}</Text> : null}
      </View>
      {shown ? (
        <StoryCard story={current} sellerName={read.data?.seller.storeName ?? ''} onOpenTarget={() => current.target && onOpenTarget(current.target)} />
      ) : (
        <StateView kind="not-found" message={t('mobile.stories.gone')} />
      )}
      <View style={styles.controls}>
        <Button kind="secondary" label={t('mobile.stories.previous')} disabled={position === 0} onPress={() => setIndex(step(position, stories.length, 'previous'))} />
        <Button kind="secondary" label={t('mobile.stories.next')} disabled={position >= stories.length - 1} onPress={() => setIndex(step(position, stories.length, 'next'))} />
        <Button label={t('mobile.stories.close')} onPress={onClose} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: theme.space.md, paddingBottom: theme.space.xl },
  position: { ...theme.text.heading, color: theme.color.text },
  left: { ...theme.text.small, color: theme.color.textSecondary },
  controls: { gap: theme.space.sm },
});
