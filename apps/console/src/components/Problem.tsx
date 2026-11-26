import { problemText } from '../features/problem';
import type { TransportError } from '../transport/port';
import { Icon } from './Icon';

/** A problem that belongs to no single field (rate limit, network). Always words plus a mark, announced when it appears. */
export function Problem({ error }: { error: TransportError | null }) {
  if (!error) return null;
  return (
    <p className="field-error problem" role="alert">
      <Icon name="alert" />
      <span>{problemText(error)}</span>
    </p>
  );
}
