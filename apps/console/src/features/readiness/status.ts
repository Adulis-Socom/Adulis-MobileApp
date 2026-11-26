import type { ReadinessItem } from '../../contracts/gap-sc';

export type Status = 'done' | 'todo' | 'waiting' | 'blocked';

/**
 * How a server-supplied readiness item is PRESENTED. What it means (satisfied, waiting, who may act) is the server's:
 * this only chooses the word and the mark. It never computes eligibility or readiness.
 */
export function statusOf(item: ReadinessItem): Status {
  if (item.satisfied) return 'done';
  if (item.workflow_state === 'WAITING_FOR_PROVIDER' || item.workflow_state === 'WAITING_FOR_DM_REVIEW') return 'waiting';
  if (item.resolving_action?.denied === 'NO_PERMISSION') return 'blocked';
  return 'todo';
}
