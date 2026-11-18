import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import { CollectionScreen } from '../../../buyer/CollectionScreen';
import { useScreenOwner } from '../../../buyer/screen-owner';
import { SignInRequired } from '../../../buyer/SignInRequired';
import { Screen } from '../../../components/Screen';
import { useT } from '../../../i18n/i18n';

/**
 * /collections/:collectionRef -- one of the signed-in Buyer's private Collections. Without a session
 * (signed out, or the session ended while this screen was open) it asks for a sign-in instead of
 * reading anything. The Collection belongs to the Account that opened it: kept in the stack while
 * another Account signs in, this screen asks for nothing and leaves for Saved when it is shown again,
 * so no request names the first Account's Collection under the second Account's credential and
 * nothing depends on the server refusing it.
 */
export default function CollectionPage() {
  const t = useT();
  const owner = useScreenOwner();
  const { collectionRef } = useLocalSearchParams();
  if (owner === 'owner') return <CollectionScreen collectionRef={collectionRef} />;
  return (
    <>
      {/* The body set the Collection's own name as the title, and unmounting it does not reset it. */}
      <Stack.Screen options={{ title: '' }} />
      {owner === 'other' ? (
        <Redirect href="/saved" />
      ) : (
        <Screen edges={['bottom', 'left', 'right']} centered>
          <SignInRequired message={t('buyer.saved.signed_out')} returnTo="/saved" />
        </Screen>
      )}
    </>
  );
}
