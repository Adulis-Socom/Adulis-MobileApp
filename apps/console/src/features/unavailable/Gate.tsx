import { Link } from 'react-router';
import type { DestinationKey } from '../../contracts/gap-sc';
import { PageTitle } from '../../components/PageTitle';
import { StatePanel } from '../../components/StatePanel';
import { t } from '../../i18n/t';
import { DESTINATIONS, destinationAccess, sellerPath } from '../../seller/access';
import { useSeller } from '../../seller/context';
import type { ReactNode } from 'react';

export function NoPermission() {
  const { sellerId } = useSeller();
  return (
    <StatePanel
      page
      kind="warn"
      title={t('state.no_permission_title')}
      actions={
        <Link className="btn btn-quiet" to={sellerPath(sellerId)}>
          {t('nav.home')}
        </Link>
      }
    >
      <p>{t('state.no_permission_body')}</p>
    </StatePanel>
  );
}

function NoEntitlement() {
  return (
    <StatePanel page kind="info" title={t('state.no_entitlement_title')}>
      <p>{t('state.no_entitlement_body')}</p>
    </StatePanel>
  );
}

/**
 * The route guard for a destination. Missing permission: nothing of the destination is rendered or fetched, and
 * direct navigation lands here, so a hidden link and a typed address behave the same. Missing entitlement: an
 * explanation. Anything else: the destination itself.
 */
export function Gate({ dest, children }: { dest: DestinationKey; children: ReactNode }) {
  const { access } = useSeller();
  const reach = destinationAccess(access, dest);
  if (reach === 'HIDDEN') return <NoPermission />;
  if (reach === 'NO_ENTITLEMENT') return <NoEntitlement />;
  return <>{children}</>;
}

/** A destination whose work order has not been built: gated like any other, then an honest "arrives later". */
export function Deferred({ dest }: { dest: DestinationKey }) {
  const meta = DESTINATIONS.find((d) => d.key === dest);
  return (
    <Gate dest={dest}>
      {meta ? (
        <>
          <PageTitle title={t(meta.area)}>{t(meta.area)}</PageTitle>
          <StatePanel kind="neutral" title={t('state.deferred_title', { area: t(meta.area) })}>
            <p>{t('state.deferred_body')}</p>
          </StatePanel>
        </>
      ) : null}
    </Gate>
  );
}
