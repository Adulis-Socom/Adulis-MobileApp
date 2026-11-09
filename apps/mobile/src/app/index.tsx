import { Redirect } from 'expo-router';

import { MODE_HOME } from '../modes/modes';

/** The app opens on Buyer Home, For You (ADU-MOB-02 v4.3 S11). */
export default function Index() {
  return <Redirect href={MODE_HOME.buyer} />;
}
