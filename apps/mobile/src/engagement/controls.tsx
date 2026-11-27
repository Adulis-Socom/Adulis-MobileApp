// The engagement controls. Likes belong to Scenes, never Products; Saves to both; Follow to Sellers. No count is ever drawn, and a
// control is a real labelled button with a state: the label changes with the state, so the state is never colour alone.
import { View } from 'react-native';

import type { SceneCardUnit } from '../contracts/gap-mob-discovery';
import { t } from '../i18n/messages';
import { Button } from '../ui/components';
import { theme } from '../ui/theme';
import { useEngagementState, useEngagementWrite, useRequireAccount, writeKey, type Write } from './hooks';

function Toggle({ on, labelOn, labelOff, write, send, pendingKey, gate }: { readonly on: boolean; readonly labelOn: string; readonly labelOff: string; readonly write: Write; readonly send: (w: Write) => void; readonly pendingKey: string | null; readonly gate: (a: () => void) => void }) {
  const busy = pendingKey === writeKey(write);
  return <Button kind={on ? 'primary' : 'secondary'} label={busy ? t('mobile.engagement.updating') : on ? labelOn : labelOff} selected={on} busy={busy} onPress={() => gate(() => send(write))} />;
}

/** Like and Save for one Scene (the For You card finally carries Save). */
export function SceneActions({ scene }: { readonly scene: SceneCardUnit }) {
  const state = useEngagementState({ sceneRefs: [scene.sceneRef] });
  const { send, pendingKey } = useEngagementWrite();
  const gate = useRequireAccount();
  const mine = state.data?.scenes[scene.sceneRef];
  const liked = mine?.liked ?? false;
  const saved = mine?.saved ?? false;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
      <Toggle on={liked} labelOn={t('mobile.engagement.unlike')} labelOff={t('mobile.engagement.like')} write={{ op: 'scene.like.set', input: { sceneRef: scene.sceneRef, liked: !liked } }} send={send} pendingKey={pendingKey} gate={gate} />
      <Toggle on={saved} labelOn={t('mobile.engagement.unsave')} labelOff={t('mobile.engagement.save')} write={{ op: 'scene.save.set', input: { sceneRef: scene.sceneRef, saved: !saved } }} send={send} pendingKey={pendingKey} gate={gate} />
    </View>
  );
}

export function ProductSave({ productRef }: { readonly productRef: string }) {
  const state = useEngagementState({ productRefs: [productRef] });
  const { send, pendingKey } = useEngagementWrite();
  const gate = useRequireAccount();
  const saved = state.data?.products[productRef]?.saved ?? false;
  return <Toggle on={saved} labelOn={t('mobile.engagement.unsave')} labelOff={t('mobile.engagement.save')} write={{ op: 'product.save.set', input: { productRef, saved: !saved } }} send={send} pendingKey={pendingKey} gate={gate} />;
}

export function SellerFollow({ sellerRef }: { readonly sellerRef: string }) {
  const state = useEngagementState({ sellerRefs: [sellerRef] });
  const { send, pendingKey } = useEngagementWrite();
  const gate = useRequireAccount();
  const following = state.data?.sellers[sellerRef]?.following ?? false;
  return <Toggle on={following} labelOn={t('mobile.engagement.unfollow')} labelOff={t('mobile.engagement.follow')} write={{ op: 'seller.follow.set', input: { sellerRef, following: !following } }} send={send} pendingKey={pendingKey} gate={gate} />;
}
