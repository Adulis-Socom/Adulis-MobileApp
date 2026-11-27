// MODE_GATED(SELLER_COMPANION). The mode is the server's answer: a direct link for an Account without it shows one neutral
// screen. The Companion's real features are a later work order; this is the gate and an honest placeholder.
import { Stack } from 'expo-router';

import { ModeGate } from '../../ui/Guard';

export default function CompanionLayout() {
  return (
    <ModeGate mode="SELLER_COMPANION" template="/companion">
      <Stack screenOptions={{ headerShown: false }} />
    </ModeGate>
  );
}
