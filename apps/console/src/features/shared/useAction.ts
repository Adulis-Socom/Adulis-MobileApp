import { useCallback, useMemo, useRef, useState } from 'react';
import type { FieldError } from '../../components/Form';
import { codeText, t } from '../../i18n/t';
import { asTransportError, type TransportError } from '../../transport/port';

/**
 * One write in flight and what came back. A validation failure becomes a summary of anchor links plus a message per field
 * (CONSOLE-02 S168), with the field codes the SERVER returned mapped through the catalogue; any other failure is a problem
 * that belongs to no single field. A CONFLICT (stale version) is its own state: the screen offers a reload, never a silent overwrite.
 */
export interface ActionApi {
  readonly busy: boolean;
  readonly error: TransportError | null;
  /** Message per field id (the key the server used). */
  readonly fields: Readonly<Record<string, string>>;
  readonly summary: readonly FieldError[];
  readonly token: number;
  readonly conflict: boolean;
  /** Runs `fn`; resolves with its result, or undefined after recording the failure. */
  run<T>(fn: () => Promise<T>): Promise<T | undefined>;
  reset(): void;
}

export function useAction(): ActionApi {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TransportError | null>(null);
  const [token, setToken] = useState(0);
  const inFlight = useRef(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    // A second activation while the first is in flight is not a second command (a double click, an Enter held down).
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(asTransportError(e));
      setToken((n) => n + 1);
      return undefined;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);
  const reset = useCallback(() => setError(null), []);

  const { fields, summary } = useMemo(() => {
    const map: Record<string, string> = {};
    if (error?.code === 'VALIDATION_FAILED') for (const [key, code] of Object.entries(error.fields)) map[key] = codeText('field_error', code) ?? t('field_error.unknown');
    return { fields: map, summary: Object.entries(map).map(([fieldId, message]) => ({ fieldId, message })) };
  }, [error]);

  return { busy, error, fields, summary, token, conflict: error?.code === 'CONFLICT', run, reset };
}
