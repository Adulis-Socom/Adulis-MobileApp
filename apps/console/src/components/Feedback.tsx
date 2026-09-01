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
      {/* A 400/409 that names its failing parts in items[] renders EVERY one
          as its message (the C-6 pass's M5: the generic title alone told a
          seller "the request is not valid" about a phone format). Anchor
          links per field remain owed where ids differ from slots.path. */}
      {problem.items && problem.items.length > 0 ? (
        <ul className="problem-items">
          {problem.items.map((it, i) => (
            <li key={`${it.code}-${i}`}>{render(it.message_key, it.slots)}</li>
          ))}
        </ul>
      ) : null}
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

/**
 * S15 wants "a summary of links that focus each invalid field". The link
 * target therefore belongs to the SCREEN, not to this component: it was
 * hard-coded to `#signin-*`, so every screen after the first got a list of
 * dead anchors.
 */
export function ValidationSummary({
  errors,
  idPrefix,
}: {
  errors: ReadonlyArray<{ field: string; message: string }>;
  idPrefix: string;
}) {
  return (
    <div role="alert" className="validation-summary">
      <p>{en['console.validation.summary']}</p>
      <ul>
        {errors.map((e) => (
          <li key={e.field}>
            <a href={`#${idPrefix}-${e.field}`}>{e.message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
