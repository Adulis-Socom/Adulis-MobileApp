import type { MobileMessageKey } from '@adulis/locale/mobile';
import { View } from 'react-native';

import { fillSlots } from '../api/messages';
import { AppText } from '../components/AppText';
import { useLocale, useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { botText, type ChatMessage, type SenderKind } from './chat';

/**
 * Who wrote a message, in the words of the side reading it (the server's sender_kind, never a guess
 * at a person): the Buyer sees "You / Seller / Seller team / Automated answer"; the store sees
 * "Buyer / Store owner / Store team member / Automated answer" (SELLER is the owner, WO-013 row 7).
 */
const SENDER: Record<'buyer' | 'seller', Record<SenderKind, MobileMessageKey>> = {
  buyer: { BUYER: 'buyer.chat.sender.you', SELLER: 'buyer.chat.sender.seller', TEAM_MEMBER: 'buyer.chat.sender.team', BOT: 'buyer.chat.sender.bot' },
  seller: { BUYER: 'seller.messages.sender.buyer', SELLER: 'seller.messages.sender.owner', TEAM_MEMBER: 'seller.messages.sender.team', BOT: 'seller.messages.sender.bot' },
};

/**
 * One message (WO-013; shared with the Seller Companion in WO-021): its sender category, its text as
 * plain text (a human message exactly as sent, an automated one only from the catalogue), whether it
 * is about a Product or an Order (never which: no read names it), and when. The viewer's own side is
 * drawn on the right.
 */
export function MessageBubble({ message: m, viewer }: { message: ChatMessage; viewer: 'buyer' | 'seller' }) {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  const secondary = { color: theme.color.textSecondary };
  const when = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  const bot = m.kind === 'BOT';
  const mine = viewer === 'buyer' ? m.kind === 'BUYER' : m.kind === 'SELLER' || m.kind === 'TEAM_MEMBER';
  return (
    <View
      accessible
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '88%',
        gap: theme.space.xs,
        padding: theme.space.md,
        marginVertical: theme.space.xs,
        borderRadius: theme.radius.md,
        borderWidth: bot ? 2 : 1,
        borderColor: bot ? theme.color.infoBorder : mine ? theme.color.accent : theme.color.border,
        backgroundColor: bot ? theme.color.infoBg : mine ? theme.color.accentSubtle : theme.color.surface,
      }}
    >
      <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{t(SENDER[viewer][m.kind])}</AppText>
      <AppText>{bot ? botText(t, m) : m.body}</AppText>
      {m.aboutProduct ? <AppText style={secondary}>{t('buyer.chat.about_product')}</AppText> : null}
      {m.aboutOrder ? <AppText style={secondary}>{t('buyer.chat.about_order')}</AppText> : null}
      <AppText style={secondary}>{fillSlots(t('buyer.chat.sent_at'), { time: when(m.sentAt) })}</AppText>
    </View>
  );
}
