import { useState, type FormEvent } from 'react';
import type { Closure, DayHours, Weekday } from '../../contracts/gap-sc-store';
import { Field, Group } from '../../components/Form';
import { label, t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { Section } from '../products/Section';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { StoreFrame, type StoreProps } from './StoreFrame';

/** A starting point for a new interval, editable like any other value. Not a rule. */
const NEW_INTERVAL = { open: '09:00', close: '17:00' } as const;

function Body({ view, onChange, onReload, editable }: StoreProps) {
  const run = useSellerCommand();
  const action = useAction(true);
  const [weekly, setWeekly] = useState<DayHours[]>(() => view.hours.weekly.map((d) => ({ day: d.day, intervals: d.intervals.map((i) => ({ ...i })) })));
  const [closures, setClosures] = useState<Closure[]>(() => view.hours.closures.map((c) => ({ ...c })));

  const editDay = (day: Weekday, change: (i: DayHours['intervals']) => DayHours['intervals']) => setWeekly((prev) => prev.map((d) => (d.day === day ? { day, intervals: change(d.intervals) } : d)));

  async function save(event: FormEvent) {
    event.preventDefault();
    const next = await action.run(() => run('store.hours.set', { version: view.version, weekly, closures }));
    if (next) onChange(next);
  }

  return (
    <Section id="hours-section" title={t('hours.title')}>
      <p className="hint">{t('hours.timezone', { timezone: view.timezone })}</p>
      <form onSubmit={(e) => void save(e)} noValidate className="stack">
        <ActionProblem action={action} onReload={onReload} />
        <fieldset className="plain-fieldset" disabled={!editable}>
          {weekly.map((d) => {
            const dayName = label('hours.day', d.day);
            return (
              <Group key={d.day} id={`hours-${d.day}`} legend={dayName} error={action.fields[`hours-${d.day}`]}>
                {d.intervals.length === 0 ? <p className="empty">{t('hours.closed', { day: dayName })}</p> : null}
                {d.intervals.map((interval, n) => (
                  <div key={n} className="stack">
                    <div className="interval">
                    <Field id={`${d.day}-${n}-open`} label={t('hours.opens', { day: dayName, n: n + 1 })}>
                      {(control) => (
                        <input
                          {...control}
                          className="text-input"
                          type="time"
                          value={interval.open}
                          onChange={(e) => editDay(d.day, (list) => list.map((x, i) => (i === n ? { ...x, open: e.target.value } : x)))}
                        />
                      )}
                    </Field>
                    <Field id={`${d.day}-${n}-close`} label={t('hours.closes', { day: dayName, n: n + 1 })}>
                      {(control) => (
                        <input
                          {...control}
                          className="text-input"
                          type="time"
                          value={interval.close}
                          onChange={(e) => editDay(d.day, (list) => list.map((x, i) => (i === n ? { ...x, close: e.target.value } : x)))}
                        />
                      )}
                    </Field>
                    </div>
                    {editable ? (
                      <div className="actions">
                        <button type="button" className="btn btn-quiet" onClick={() => editDay(d.day, (list) => list.filter((_, i) => i !== n))}>
                          {t('hours.remove', { day: dayName, n: n + 1 })}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
                {editable ? (
                  <div className="actions">
                    <button type="button" className="btn btn-quiet" onClick={() => editDay(d.day, (list) => [...list, { ...NEW_INTERVAL }])}>
                      {t('hours.add', { day: dayName })}
                    </button>
                  </div>
                ) : null}
              </Group>
            );
          })}
        </fieldset>

        <h3>{t('hours.closures_title')}</h3>
        <p className="hint">{t('hours.closures_hint')}</p>
        {closures.length === 0 ? <p className="empty">{t('hours.closures_none')}</p> : null}
        <fieldset className="plain-fieldset" disabled={!editable}>
          {closures.map((c, i) => (
            <div key={i} className="stack">
              <Field id={`closure-${i}`} label={t('hours.closure_date', { n: i + 1 })} error={action.fields[`closure-${i}`]}>
                {(control) => <input {...control} className="text-input" type="date" value={c.date} onChange={(e) => setClosures((prev) => prev.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />}
              </Field>
              <Field id={`closure-note-${i}`} label={t('hours.closure_note', { n: i + 1 })}>
                {(control) => <input {...control} className="text-input" type="text" value={c.note} onChange={(e) => setClosures((prev) => prev.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />}
              </Field>
              {editable ? (
                <div className="actions">
                  <button type="button" className="btn btn-quiet" onClick={() => setClosures((prev) => prev.filter((_, j) => j !== i))}>
                    {t('hours.closure_remove', { n: i + 1 })}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </fieldset>
        {editable ? (
          <div className="actions">
            <button type="button" className="btn btn-quiet" onClick={() => setClosures((prev) => [...prev, { date: '', note: '' }])}>
              {t('hours.closure_add')}
            </button>
          </div>
        ) : null}
        {editable ? (
          <div className="actions">
            <button type="submit" className="btn btn-primary" aria-disabled={action.busy}>
              {action.busy ? t('editor.saving') : t('hours.save')}
            </button>
          </div>
        ) : null}
      </form>
    </Section>
  );
}

/**
 * Opening hours and closure dates (CONSOLE-02 S102-S103, S125): local business time in the Market timezone the server names,
 * sent as local times with that timezone as context, never converted with the browser clock. Overlap and bad times are the
 * server's to refuse; the answers land beside the day or date they belong to.
 */
export function StoreHours() {
  return <StoreFrame title={t('hours.page')}>{(p) => <Body {...p} />}</StoreFrame>;
}
