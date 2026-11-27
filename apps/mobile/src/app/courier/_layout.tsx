// MODE_GATED(COURIER). Relationships, invitations and availability only, from server answers. There is no open Courier
// application and no live delivery here.
import { Stack } from 'expo-router';

import { ModeGate } from '../../ui/Guard';

export default function CourierLayout() {
  return (
    <ModeGate mode="COURIER" template="/courier">
      <Stack screenOptions={{ headerShown: false }} />
    </ModeGate>
  );
}
