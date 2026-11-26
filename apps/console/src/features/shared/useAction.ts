import { useCallback, useMemo, useRef, useState } from 'react';
import type { FieldError } from '../../components/Form';
import { codeText, t } from '../../i18n/t';
import { isStaleCompletion } from '../../seller/useSellerCommand';
import { asTransportError, TransportError } from '../../transport/port';

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
  /** True after a successful run of a form that announces its save (`useAction(true)`); cleared by the next run or reset. */
  readonly saved: boolean;
  /** Runs `fn`; resolves with its result, or undefined after recording the failure. */
  run<T>(fn: () => Promise<T>): Promise<T | undefined>;
  /** Record a validation failure found before anything was sent: field id to a `field_error.*` code. Same summary, same field messages, same focus. */
  fail(fields: Readonly<Record<string, string>>): void;
  reset(): void;
}

export function useAction(announceSaved = false): ActionApi {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<TransportError | null>(null);
  const [token, setToken] = useState(0);
  const inFlight = useRef(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    // A second activation while the first is in flight is not a second command (a double click, an Enter held down).
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const result = await fn();
      if (announceSaved) setSaved(true);
      return result;
    } catch (e) {
      // The screen this write belonged to is gone: nothing here may show a notice or move focus.
      if (isStaleCompletion(e)) return undefined;
      setError(asTransportError(e));
      setToken((n) => n + 1);
      return undefined;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [announceSaved]);
  const reset = useCallback(() => {
    setError(null);
    setSaved(false);
  }, []);
  const fail = useCallback((fields: Readonly<Record<string, string>>) => {
    setError(new TransportError('VALIDATION_FAILED', { fields: { ...fields } }));
    setToken((n) => n + 1);
  }, []);

  const { fields, summary } = useMemo(() => {
    const map: Record<string, string> = {};
    if (error?.code === 'VALIDATION_FAILED') for (const [key, code] of Object.entries(error.fields)) map[key] = codeText('field_error', code) ?? t('field_error.unknown');
    return { fields: map, summary: Object.entries(map).map(([fieldId, message]) => ({ fieldId, message })) };
  }, [error]);

  return { busy, error, fields, summary, token, conflict: error?.code === 'CONFLICT', saved, run, fail, reset };
}
