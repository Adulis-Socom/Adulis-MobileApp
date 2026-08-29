/**
 * components/Feedback.tsx -- the error/state primitives every screen
 * shares. Content rules they encode:
 *  - S4.6: every TRANSPORT_ERROR shows the request id in SELECTABLE text.
 *  - S15: validation renders a summary of anchor links PLUS per-field
 *    messages; no state is conveyed by colour alone (each carries text).
 *  - S7: the server sends message_key + slots; the client renders from the
 *    catalogue. No server prose is ever displayed.
 */
import { en, type MessageKey } from '@adulis/locale';
import type { AdulisProblem } from '../lib/states';
import { fillTemplate } from '../lib/intl';

function render(key: string, slots?: Record<string, unknown>): string {
  const catalogue = en as Record<string, string>;
  const template = catalogue[key as MessageKey];
  if (!template) return key; // an unknown key renders AS the key -- visible, greppable
  return fillTemplate(
    template,
    Object.fromEntries(Object.entries(slots ?? {}).map(([k, v]) => [k, String(v)])),
  );
}

export function ProblemBanner({ problem }: { problem: AdulisProblem }) {
  return (
    <div role="alert" className="problem">
      <p>{render(problem.title_key, problem.slots)}</p>
      {problem.status === 429 && problem.slots?.['retry_after_seconds'] !== undefined ? (
        <p>
          {fillTemplate(en['console.signin.rate_limited'], {
            seconds: String(problem.slots['retry_after_seconds']),
          })}
        </p>
      ) : null}
      {problem.status >= 500 || problem.status === 0 ? (
        <p className="request-id">
          {en['console.error.request_id']} <code>{problem.request_id || '-'}</code>
        </p>
      ) : null}
    </div>
  );
}

export function ValidationSummary({
  errors,
}: {
  errors: ReadonlyArray<{ field: string; message: string }>;
}) {
  return (
    <div role="alert" className="validation-summary">
      <p>{en['console.validation.summary']}</p>
      <ul>
        {errors.map((e) => (
          <li key={e.field}>
            <a href={`#signin-${e.field}`}>{e.message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
