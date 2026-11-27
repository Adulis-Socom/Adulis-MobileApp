// One key per user intent, kept across retries so a retried verify is the same intent (idempotency), never a second one.
export function newIntentKey(): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  return `ik-${uuid ?? Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
}
