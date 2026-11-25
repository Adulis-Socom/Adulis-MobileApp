import type { SellerSummary } from '../contracts/gap-sc';
import { label } from '../i18n/t';
import { Badge, type Tone } from './Badge';

const STATUS_TONE: Record<SellerSummary['status'], Tone> = { DRAFT: 'neutral', ACTIVE: 'success', SUSPENDED: 'warn' };
const PUBLICATION_TONE: Record<SellerSummary['publication'], Tone> = { NEVER_PUBLISHED: 'neutral', PUBLISHED: 'success', UNPUBLISHED: 'warn' };

/** Seller state in words plus a mark. A Draft is not yet published, so its publication state adds nothing. */
export function SellerBadges({ seller }: { seller: SellerSummary }) {
  return (
    <span className="badges">
      <Badge tone={STATUS_TONE[seller.status]}>{label('seller.status', seller.status)}</Badge>
      {seller.status === 'DRAFT' ? null : <Badge tone={PUBLICATION_TONE[seller.publication]}>{label('seller.publication', seller.publication)}</Badge>}
    </span>
  );
}
