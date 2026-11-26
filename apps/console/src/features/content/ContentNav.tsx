import { NavLink } from 'react-router';
import { t } from '../../i18n/t';
import { sellerPath } from '../../seller/access';
import { useSeller } from '../../seller/context';

/** The two things Content holds. A plain link pair: the current one is marked by aria-current, set by the router. */
export function ContentNav() {
  const { sellerId } = useSeller();
  return (
    <nav aria-label={t('content.nav_label')} className="actions">
      <NavLink className="btn btn-quiet" to={sellerPath(sellerId, 'content')} end>
        {t('content.nav_scenes')}
      </NavLink>
      <NavLink className="btn btn-quiet" to={sellerPath(sellerId, 'content/stories')} end>
        {t('content.nav_stories')}
      </NavLink>
    </nav>
  );
}
