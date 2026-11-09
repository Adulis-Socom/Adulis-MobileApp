import { Placeholder } from '../../../components/Placeholder';
import { Screen } from '../../../components/Screen';
import { useT } from '../../../i18n/i18n';

/**
 * Shop (ADU-MOB-02 v4.3 S32): intentional Product and category discovery. Structure only:
 * no catalogue reads, categories, filters or Product cards until those domains exist.
 */
export default function Shop() {
  const t = useT();
  return (
    <Screen title={t('buyer.tab.shop')} edges={['top', 'left', 'right']} centered>
      <Placeholder message={t('buyer.shop.coming')} />
    </Screen>
  );
}
