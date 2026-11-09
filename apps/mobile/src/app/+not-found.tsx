import { Redirect } from 'expo-router';

import { MODE_HOME } from '../modes/modes';

/**
 * Deep-link input is untrusted (ADU-MOB-02 v4.3 S54): a path the app does not have goes
 * to Buyer Home rather than to the router's developer-facing "unmatched route" page.
 */
export default function NotFound() {
  return <Redirect href={MODE_HOME.buyer} />;
}
