/**
 * layout/More.tsx -- the fifth destination's full-page menu (v1.2 S2.1/S2.3):
 * Insights, Store, Settings, Billing. A full page, not a drawer that traps
 * focus.
 *
 * S2.3's table carries v1.0-era screen NUMBERS (SC-20 Identity, SC-25
 * Sessions...); the group F/G table and the section headers carry the v1.2
 * numbering, and names win over stale numbers -- the entries here are the
 * NAMES, mapped to the routes this router serves. Payout appears under no
 * S2.3 section at all (a doc gap, register D-224); it sits under Billing
 * beside Subscription as the minimal reading, recorded rather than silent.
 *
 * Insights' three screens are C-7 and route to placeholders -- the D-146
 * lesson: a menu entry that silently returns you to Home teaches that the
 * menu is decorative, so the placeholder says what it is instead.
 */
import { Link, useParams } from 'react-router';
import { en } from '@adulis/locale';

interface Entry {
  readonly to: string;
  readonly label: string;
}
interface Group {
  readonly heading: string;
  readonly entries: readonly Entry[];
}

const GROUPS: readonly Group[] = [
  {
    heading: en['console.more.insights'],
    entries: [
      { to: 'insights', label: en['console.more.analytics'] },
      { to: 'insights/trust', label: en['console.more.trust'] },
      { to: 'insights/reviews', label: en['console.more.reviews'] },
    ],
  },
  {
    heading: en['console.more.store'],
    entries: [
      { to: 'profile', label: en['console.more.profile'] },
      { to: 'fulfilment', label: en['console.more.fulfilment'] },
      { to: 'availability', label: en['console.more.availability'] },
      { to: 'eligibility', label: en['console.more.identity'] },
      { to: 'couriers', label: en['console.more.couriers'] },
    ],
  },
  {
    heading: en['console.more.settings'],
    entries: [
      { to: 'sessions', label: en['console.more.sessions'] },
      { to: 'notification-preferences', label: en['console.more.notifications'] },
      { to: 'team', label: en['console.more.team'] },
      { to: 'closure', label: en['console.more.closure'] },
    ],
  },
  {
    heading: en['console.more.billing'],
    entries: [
      { to: 'subscription', label: en['console.more.subscription'] },
      { to: 'payouts', label: en['console.more.payout'] },
    ],
  },
];

export function More() {
  const { sellerId } = useParams<{ sellerId: string }>();
  return (
    <section aria-labelledby="more-heading" className="more-menu">
      <h1 id="more-heading">{en['console.nav.more']}</h1>
      {GROUPS.map((g) => (
        <section key={g.heading} aria-label={g.heading} className="more-group">
          <h2>{g.heading}</h2>
          <ul>
            {g.entries.map((e) => (
              <li key={e.to}>
                <Link to={`/s/${sellerId}/${e.to}`}>{e.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

/** The same groups, for the desktop sidebar's expanded More (S2.1). */
export const MORE_GROUPS = GROUPS;
