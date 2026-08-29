/**
 * features/entry/StateDemo.tsx -- C-1's "twelve states demonstrable", made
 * literal: every branch of the closed vocabulary, selectable, rendered by
 * the SAME component every real screen will use. This is Home's
 * placeholder until SC-01 (stage C-3).
 */
import { useState } from 'react';
import { en } from '@adulis/locale';
import { UI_STATES, type UiState } from '../../lib/states';
import { ScreenState } from '../../components/ScreenState';

const DEMO_PROBLEM = {
  type: 'https://adulis.example/errors/internal',
  title_key: 'error.request.internal',
  status: 500,
  code: 'INTERNAL',
  request_id: 'demo-request-id',
  retryable: true,
} as const;

export function StateDemo() {
  const [state, setState] = useState<UiState>('READY');
  return (
    <section>
      <h1>{en['console.demo.title']}</h1>
      <p className="hint">{en['console.demo.hint']}</p>
      <div role="tablist" aria-label={en['console.demo.title']} className="demo-picker">
        {UI_STATES.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={s === state}
            onClick={() => setState(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="demo-stage">
        <ScreenState
          state={state}
          problem={DEMO_PROBLEM}
          validationErrors={[{ field: 'phone', message: en['console.signin.phone_invalid'] }]}
          emptyText={en['console.states.empty_default']}
          onRetry={() => setState('READY')}
        >
          <p>{en['console.demo.ready_content']}</p>
        </ScreenState>
      </div>
    </section>
  );
}
