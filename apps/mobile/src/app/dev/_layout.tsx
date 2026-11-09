import { Redirect, Slot } from 'expo-router';

import { MODE_HOME } from '../../modes/modes';

/**
 * Foundation diagnostics are a development tool (WO-002): a release build never renders
 * them, whatever link reaches this path.
 */
export default function DevLayout() {
  return __DEV__ ? <Slot /> : <Redirect href={MODE_HOME.buyer} />;
}
