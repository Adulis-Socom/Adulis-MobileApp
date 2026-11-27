import type { Metric } from '../contracts/gap-sc-metrics';
import { t } from '../i18n/t';

/**
 * One server-resolved figure. A real zero is shown as 0; every other state is a sentence, never a zero, a dash or a blank, so "nothing
 * happened", "too few to show", "not known", "not available yet" and "not measured in this release" can never be mistaken for each other.
 */
const SENTENCE = { WITHHELD: 'metric.WITHHELD', UNKNOWN: 'metric.UNKNOWN', UNAVAILABLE: 'metric.UNAVAILABLE', UNSUPPORTED: 'metric.UNSUPPORTED' } as const;

export function MetricValue({ metric }: { metric: Metric }) {
  if (metric.state === 'VALUE') return <>{new Intl.NumberFormat('en').format(metric.value)}</>;
  return <span className="hint">{t(SENTENCE[metric.state])}</span>;
}
