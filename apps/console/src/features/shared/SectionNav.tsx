import { t } from '../../i18n/t';

export interface SectionLink {
  readonly id: string;
  readonly label: string;
}

/**
 * Where to jump in a long editor. Plain in-page links; activating one also moves focus to that section's heading, so keyboard and
 * screen-reader users land where they asked, not merely where the page scrolled.
 */
export function SectionNav({ links }: { links: readonly SectionLink[] }) {
  return (
    <nav aria-label={t('onpage.label')}>
      <ul className="plain-list row-start">
        {links.map((l) => (
          <li key={l.id}>
            <a
              className="btn btn-quiet"
              href={`#${l.id}`}
              onClick={(e) => {
                const heading = document.getElementById(`${l.id}-h`);
                if (!heading) return;
                e.preventDefault();
                heading.scrollIntoView({ block: 'start' });
                heading.focus();
              }}
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
