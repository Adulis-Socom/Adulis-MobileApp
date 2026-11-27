import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
import { t } from '../i18n/t';

export interface FieldError {
  readonly fieldId: string;
  readonly message: string;
}

/** A summary of anchor links to each invalid field plus the per-field messages (CONSOLE-02 S168). Takes focus when it appears. */
export function ErrorSummary({ errors, focusToken }: { errors: readonly FieldError[]; focusToken: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errors.length > 0) ref.current?.focus();
    // Focus moves only when a new submit produced errors, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken]);
  if (errors.length === 0) return null;
  return (
    <div ref={ref} tabIndex={-1} className="error-summary" role="alert">
      <h2>{t('form.summary_title')}</h2>
      <ul>
        {errors.map((e) => (
          <li key={e.fieldId}>
            <a href={`#${e.fieldId}`}>{e.message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface ControlProps {
  readonly id: string;
  readonly 'aria-describedby': string | undefined;
  readonly 'aria-invalid': boolean;
}

function Message({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="field-error">
      <Icon name="alert" />
      <span>{children}</span>
    </p>
  );
}

/** Label, hint and error wired to the control with ids. Every input has a visible <label for>. */
export function Field({ id: given, label, hint, error, children }: { id?: string; label: ReactNode; hint?: string; error?: string | undefined; children: (props: ControlProps) => ReactNode }) {
  const raw = useId();
  const id = given ?? `f${raw.replace(/:/g, '')}`;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(' ');
  return (
    <div className={error ? 'field field-invalid' : 'field'}>
      <label htmlFor={id}>{label}</label>
      {hint ? (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
      {error ? <Message id={`${id}-err`}>{error}</Message> : null}
      {children({ id, 'aria-describedby': describedBy || undefined, 'aria-invalid': Boolean(error) })}
    </div>
  );
}

/** Same idea for a radio or checkbox group: a fieldset with a legend, so the group has one accessible name. */
export function Group({ legend, hint, error, id, children }: { legend: string; hint?: string; error?: string | undefined; id: string; children: ReactNode }) {
  const described = [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(' ');
  return (
    <fieldset id={id} className={error ? 'group field-invalid' : 'group'} aria-describedby={described || undefined}>
      <legend>{legend}</legend>
      {hint ? (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
      {error ? <Message id={`${id}-err`}>{error}</Message> : null}
      {children}
    </fieldset>
  );
}
