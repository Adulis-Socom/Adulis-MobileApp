import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';

import { failureMessage, fillSlots } from '../../api/messages';
import { AlertText, StatusText } from '../../components/AlertText';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { formatMinor, useLocale, useT } from '../../i18n/i18n';
import { useTheme } from '../../theme/theme';
import { useCarts } from '../cart/hooks';
import { LINE_ISSUES, allLines, type CartLine, type SellerCart } from '../cart/model';
import { mayDrawFacts, sellerCartStatus, type CartViewState, type Freshness } from '../cart/view-state';
import { LINE_ISSUE_KEY, UNVERIFIED_KEY } from './cart-copy';

/**
 * The internal fixture Cart, drawn (BUY-12A). It only DRAWS what the carts hook derives: every Seller's cart on its own
 * (nothing merged, no combined total), each line as the server described it, the server's prices and subtotal and
 * never a computed one, and the reasons the Cart model defines and no other. It carries no control that changes a cart
 * and none that buys: quantity, removal, a variant change and accepting a price are decisions still open (BUY13-D-02,
 * BUY12-D-04, BUY13-D-01), so the only action is to ask the server again.
 *
 * It is a development-only surface: nothing outside the commerce folder imports it, no route reaches it, and a release
 * build serves the disabled adapter, so it draws "not available" there (commerce-guard.test.tsx G1, G2, G11, G13).
 */

/** The carts the commerce provider serves, drawn, whatever adapter it serves. Mounted by tests only today. */
export function InternalCart() {
  const { view, refresh } = useCarts({ focused: true });
  return <CartView view={view} onRefresh={refresh} />;
}

/** One state of the cart, as deriveViewState names it. Pure: no read, no request. */
export function CartView({ view, onRefresh }: { view: CartViewState; onRefresh: () => void }) {
  const t = useT();
  const theme = useTheme();

  if (view.kind === 'DISABLED') {
    return (
      <Panel>
        <StatusText style={{ textAlign: 'center' }}>{t('buyer.cart.unavailable')}</StatusText>
      </Panel>
    );
  }
  if (view.kind === 'LOADING') {
    return (
      <Panel>
        {view.waitingForConnection ? (
          <AlertText style={{ textAlign: 'center' }}>{t('common.offline')}</AlertText>
        ) : (
          <>
            <ActivityIndicator color={theme.color.accent} importantForAccessibility="no" accessibilityElementsHidden />
            <StatusText style={{ color: theme.color.textSecondary }}>{t('buyer.cart.loading')}</StatusText>
          </>
        )}
      </Panel>
    );
  }
  if (view.kind === 'ERROR') {
    return (
      <Panel>
        <AlertText style={{ textAlign: 'center' }}>{`${t('buyer.cart.error')} ${failureMessage(t, view.error)}`}</AlertText>
        <Button label={t('common.retry')} onPress={onRefresh} />
      </Panel>
    );
  }

  const { carts, freshness, provenance } = view;
  const facts = mayDrawFacts(freshness);
  const anyIssue = facts && allLines(carts).some((line) => line.issues.length > 0);
  const noLines = carts.carts.every((c) => c.lines.length === 0);
  // Empty is claimed only of an answer that is the server's last word: not while a new one is awaited, not when unverified.
  const verified = freshness.kind === 'VERIFIED';
  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      {/* Persistent: outside the scrolling content, so a long cart cannot scroll the marker away (rev 2 section 8). */}
      {provenance === 'FIXTURE' ? (
        <View style={{ paddingHorizontal: theme.space.lg, paddingVertical: theme.space.sm, borderBottomWidth: 1, borderBottomColor: theme.color.border }}>
          <AppText testID="cart-fixture-marker" style={{ color: theme.color.textSecondary }}>
            {t('buyer.cart.fixture_marker')}
          </AppText>
        </View>
      ) : null}
      <ScrollView
        testID="fixture-cart"
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.lg }}
        refreshControl={
          <RefreshControl refreshing={freshness.kind === 'REVALIDATING'} onRefresh={onRefresh} colors={[theme.color.accent]} />
        }
      >
        <AppText variant="heading" accessibilityRole="header">
          {t('buyer.cart.title')}
        </AppText>
        <FreshnessNote freshness={freshness} onRefresh={onRefresh} />
        {noLines && verified ? <AppText>{t('buyer.cart.empty')}</AppText> : null}
        {carts.carts.map((cart, index) => (
          // Two Seller carts can share a key (an unresolved guest-to-Account conflict): the index keeps them apart.
          <SellerSection key={`${cart.key}-${index}`} cart={cart} freshness={freshness} />
        ))}
        {anyIssue ? <Button label={t('buyer.cart.refresh')} variant="secondary" onPress={onRefresh} /> : null}
      </ScrollView>
    </View>
  );
}

/** A short state in the middle of the screen. */
function Panel({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      testID="fixture-cart-state"
      style={{ flex: 1, backgroundColor: theme.color.bg, alignItems: 'center', justifyContent: 'center', padding: theme.space.lg, gap: theme.space.md }}
    >
      {children}
    </View>
  );
}

function FreshnessNote({ freshness, onRefresh }: { freshness: Freshness; onRefresh: () => void }) {
  const t = useT();
  const theme = useTheme();
  if (freshness.kind === 'VERIFIED') return null;
  if (freshness.kind === 'REVALIDATING') {
    return <StatusText style={{ color: theme.color.textSecondary }}>{t('buyer.cart.checking')}</StatusText>;
  }
  return (
    <View style={{ gap: theme.space.sm }}>
      <AlertText>{t(UNVERIFIED_KEY[freshness.why])}</AlertText>
      <Button label={t('buyer.cart.refresh')} variant="secondary" onPress={onRefresh} />
    </View>
  );
}

function SellerSection({ cart, freshness }: { cart: SellerCart; freshness: Freshness }) {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  const facts = mayDrawFacts(freshness);
  const status = sellerCartStatus(cart, freshness);
  const name = cart.storeName ?? cart.handle ?? t('buyer.cart.seller_fallback');
  const subtotal =
    facts && cart.subtotal !== null
      ? fillSlots(t('buyer.cart.subtotal'), { price: formatMinor(locale, cart.subtotal.amountMinor, cart.subtotal.currency) })
      : null;
  return (
    <View
      testID={`seller-cart-${cart.key}`}
      style={{
        gap: theme.space.md,
        padding: theme.space.md,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.color.border,
      }}
    >
      <AppText variant="heading" accessibilityRole="header">
        {name}
      </AppText>
      {status === 'EMPTY' && freshness.kind === 'VERIFIED' ? (
        <AppText style={{ color: theme.color.textSecondary }}>{t('buyer.cart.seller_empty')}</AppText>
      ) : null}
      {cart.lines.map((line) => (
        <LineRow key={line.lineId} line={line} freshness={freshness} />
      ))}
      {subtotal ? <AppText testID={`subtotal-${cart.key}`}>{subtotal}</AppText> : null}
    </View>
  );
}

function LineRow({ line, freshness }: { line: CartLine; freshness: Freshness }) {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  const facts = mayDrawFacts(freshness);
  const secondary = { color: theme.color.textSecondary };
  const name = line.name ?? t('buyer.cart.item_fallback');
  const quantity = fillSlots(t('buyer.cart.quantity'), { count: line.quantity.toLocaleString(locale) }) ?? '';
  const price =
    facts && line.unitPrice
      ? fillSlots(t('buyer.cart.price_each'), { price: formatMinor(locale, line.unitPrice.amountMinor, line.unitPrice.currency) })
      : null;
  const was =
    facts && line.issues.includes('PRICE_CHANGED') && line.previousUnitPrice
      ? fillSlots(t('buyer.cart.was_price'), {
          price: formatMinor(locale, line.previousUnitPrice.amountMinor, line.previousUnitPrice.currency),
        })
      : null;
  // In the model's display precedence, whatever order the line arrived in.
  const issues = facts
    ? [...line.issues].sort((a, b) => LINE_ISSUES.indexOf(a) - LINE_ISSUES.indexOf(b)).map((issue) => t(LINE_ISSUE_KEY[issue]))
    : [];
  const only =
    facts && line.issues.includes('INSUFFICIENT_STOCK') && line.availableQuantity !== null
      ? fillSlots(t('buyer.cart.available_count'), { count: line.availableQuantity.toLocaleString(locale) })
      : null;
  // One stop for a screen reader: the line as a sentence, in the order it is read.
  const label = [name, line.option, quantity, price, was, ...issues, only].filter((x): x is string => Boolean(x)).join('. ');
  return (
    <View
      testID={`cart-line-${line.lineId}`}
      accessible
      accessibilityLabel={label}
      style={{ gap: theme.space.xs, paddingVertical: theme.space.xs }}
    >
      <AppText>{name}</AppText>
      {line.option ? <AppText style={secondary}>{line.option}</AppText> : null}
      <AppText style={secondary}>{quantity}</AppText>
      {price ? <AppText>{price}</AppText> : null}
      {was ? <AppText style={secondary}>{was}</AppText> : null}
      {issues.map((text, i) => (
        <AppText key={`${line.lineId}-${i}`} style={{ color: theme.color.danger }}>
          {text}
        </AppText>
      ))}
      {only ? <AppText style={secondary}>{only}</AppText> : null}
    </View>
  );
}
