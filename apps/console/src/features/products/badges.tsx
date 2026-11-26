import type { Availability, ProductState } from '../../contracts/gap-sc-catalogue';
import { Badge, type Tone } from '../../components/Badge';
import type { IconName } from '../../components/Icon';
import { label } from '../../i18n/t';

const STATE: Record<ProductState, { tone: Tone; icon: IconName }> = {
  DRAFT: { tone: 'neutral', icon: 'circle' },
  PUBLISHED: { tone: 'success', icon: 'check' },
  WITHDRAWN: { tone: 'neutral', icon: 'x' },
  RESTRICTED: { tone: 'warn', icon: 'lock' },
};
/** Publication state: icon plus word, never colour alone. A state this version does not know shows its code, neutral. */
export function StateBadge({ state }: { state: ProductState }) {
  const look = STATE[state] ?? { tone: 'neutral' as const, icon: 'circle' as const };
  return (
    <Badge tone={look.tone} icon={look.icon}>
      {label('product.state', state)}
    </Badge>
  );
}

const AVAIL: Record<Availability, { tone: Tone; icon: IconName }> = {
  AVAILABLE: { tone: 'success', icon: 'check' },
  LOW: { tone: 'warn', icon: 'alert' },
  NOT_AVAILABLE: { tone: 'danger', icon: 'x' },
};
/** The server-resolved label (CATINV S66): the Console never applies a low-stock threshold. */
export function AvailabilityBadge({ availability }: { availability: Availability }) {
  const look = AVAIL[availability] ?? { tone: 'neutral' as const, icon: 'circle' as const };
  return (
    <Badge tone={look.tone} icon={look.icon}>
      {label('availability', availability)}
    </Badge>
  );
}
