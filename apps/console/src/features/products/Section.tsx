import type { ReactNode } from 'react';

/** One titled panel of an editor. The heading names the region, so a screen-reader user can jump between sections. */
export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="panel" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} tabIndex={-1}>
        {title}
      </h2>
      {children}
    </section>
  );
}
