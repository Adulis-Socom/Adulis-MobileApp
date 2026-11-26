import { Link } from 'react-router';
import { StatePanel } from '../../components/StatePanel';
import { t } from '../../i18n/t';
import { PlainFrame } from '../../layout/PlainFrame';

function Body() {
  return (
    <>
      <StatePanel
        page
        kind="neutral"
        title={t('state.not_found_title')}
        actions={
          <Link className="btn btn-quiet" to="/sellers">
            {t('state.back_to_sellers')}
          </Link>
        }
      >
        <p>{t('state.not_found_body')}</p>
      </StatePanel>
    </>
  );
}

/** Not found inside a Seller (the shell is already around it). */
export function NotFoundInSeller() {
  return <Body />;
}

/** Not found outside any Seller. */
export function NotFound() {
  return (
    <PlainFrame>
      <Body />
    </PlainFrame>
  );
}
