import { useLocalSearchParams } from 'expo-router';

import { CollectionScreen } from '../../../buyer/CollectionScreen';

/** /collections/:collectionRef -- one of the signed-in Buyer's private Collections (WO-009). */
export default function CollectionPage() {
  const { collectionRef } = useLocalSearchParams();
  return <CollectionScreen collectionRef={collectionRef} />;
}
