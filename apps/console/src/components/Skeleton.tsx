import { t } from '../i18n/t';

/** Structural skeleton: keeps the layout of what is loading, announces once, never a blank page with a spinner. */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton-block" role="status" aria-busy="true">
      <span className="sr-only">{t('app.loading')}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" aria-hidden="true" />
      ))}
    </div>
  );
}
