import { useEffect, useRef, type ReactNode } from 'react';
import { t } from '../i18n/t';

/**
 * The page's one h1. After a route change it takes focus so a keyboard or screen-reader user lands on the new page rather
 * than at the old position, and it sets the document title. Remounts when the route or the Seller changes.
 */
export function PageTitle({ children, title }: { children: ReactNode; title: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${title} - ${t('app.name')}`;
    // Not on the first entry of the app: there the skip link must stay the first stop. React Router numbers history entries.
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) ref.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <h1 ref={ref} tabIndex={-1} className="page-title">
      {children}
    </h1>
  );
}
