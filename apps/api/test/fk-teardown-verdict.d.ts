export interface TeardownVerdict {
  ok: boolean;
  reason: 'pass' | 'orphans' | 'did-not-run' | 'no-pass-line';
  message: string;
}

export function teardownVerdict(run: {
  status: number | null;
  signal: string | null;
  error?: Error | undefined;
  stdout?: string | null;
}): TeardownVerdict;
