import { Placeholder } from '../../components/Placeholder';
import { Screen } from '../../components/Screen';
import { useT } from '../../i18n/i18n';

/**
 * Search (ADU-MOB-02 v4.3 S33): one marketplace search across Products, Sellers and Scenes,
 * whose backend does not exist yet. No input field until it does, and never the legacy
 * Seller-only storefront search in its place.
 */
export default function Search() {
  const t = useT();
  return (
    <Screen edges={['bottom', 'left', 'right']} centered>
      <Placeholder message={t('buyer.search.coming')} />
    </Screen>
  );
}
