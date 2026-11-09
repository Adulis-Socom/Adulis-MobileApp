import { Redirect } from 'expo-router';

import { MODE_HOME } from '../modes/modes';

/**
 * Replaces Expo Router's generated sitemap, which would otherwise list every route file
 * (development diagnostics included) to anyone who opens adulis://_sitemap, in release
 * builds too. Development has /dev for that.
 */
export default function Sitemap() {
  return <Redirect href={MODE_HOME.buyer} />;
}
