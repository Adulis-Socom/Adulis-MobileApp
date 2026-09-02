/**
 * features/store/Availability.tsx -- SC-19 Availability (ADU-CON-03 v1.2 S11).
 *
 * TWO SECTIONS, KEPT VISIBLY SEPARATE: the weekly pattern, and the exceptions
 * to it (R27 -- holiday overrides are INCLUDED, a founder ruling recorded as
 * an override of the recommendation against them).
 *
 * The screen says, verbatim in intent: availability tells buyers when to
 * expect a reply and GATES NOTHING -- a seller who believes it is a gate will
 * over-report and then miss it. Zero windows is valid.
 *
 * THE WEEKLY PATTERN READS BACK (T15 Phase 4 closed D-224's absence here):
 * GET /v1/seller/availability returns the saved set in the PUT's own shape,
 * so the editor loads the real hours and a save is proven by reading them
 * back. The weekly read and the overrides read are SPLIT (Phase 5 pass M2):
 * an override write's refetch must never clobber a weekly draft mid-edit.
 *
 * OVERRIDES ARE CLOSURES ONLY, deliberately (S11): a date on which the store
 * is closed, with an optional note shown on the storefront and in the
 * chatbot's out-of-hours reply. There is NO "different hours on this date" --
 * the founder's design fixes presence-of-row = closed (R27's schema note:
 * no is_closed boolean, "a row that says false is a row that means nothing").
 * The server UPSERTS a duplicate date (it updates the note); the spec's
 * VALIDATION state for "a date already overridden" is enforced here against
 * the loaded list, and the delta is registered.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import { ScreenState } from '../../components/ScreenState';
import type { UiState, AdulisProblem } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import type { AvailabilityOverride, OverridePage } from './types';

const WEEKDAYS: readonly { day: number; label: string }[] = [
  { day: 1, label: en['console.store.availability.monday'] },
  { day: 2, label: en['console.store.availability.tuesday'] },
  { day: 3, label: en['console.store.availability.wednesday'] },
  { day: 4, label: en['console.store.availability.thursday'] },
  { day: 5, label: en['console.store.availability.friday'] },
  { day: 6, label: en['console.store.availability.saturday'] },
  { day: 7, label: en['console.store.availability.sunday'] },
];

interface WindowDraft {
  weekday: number;
  opens_at: string;
  closes_at: string;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function Availability() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [windows, setWindows] = useState<readonly WindowDraft[]>([]);
  const [overrides, setOverrides] = useState<readonly AvailabilityOverride[]>([]);
  const [past, setPast] = useState<readonly AvailabilityOverride[] | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  const [state, setState] = useState<UiState>('LOADING');
  const [loaded, setLoaded] = useState(false);
  const [weeklyFailed, setWeeklyFailed] = useState(false);
  const [loadProblem, setLoadProblem] = useState<AdulisProblem | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newNote, setNewNote] = useState('');

  /**
   * TWO READS, SPLIT DELIBERATELY (Phase 5 pass M2): the overrides load runs
   * after every override write, and if it also replaced `windows` it would
   * clobber a weekly draft the seller is mid-edit on -- the D-221 class. So
   * the weekly pattern loads on mount and after ITS OWN save only.
   */
  const loadWindows = useCallback(
    async (onlyIfStill?: readonly WindowDraft[]) => {
      if (!sellerId) return;
      try {
        // The weekly pattern loads (T15 Phase 4): the editor edits the SAVED
        // hours, not a blank draft. Zero windows is a valid closed pattern.
        const wk = await api<{ windows: WindowDraft[] }>(`/seller/availability`, { sellerId });
        setWindows((cur) =>
          // The post-save read-back replaces the draft ONLY if the seller has
          // not typed since the save left (the dirty guard the pass asked for).
          onlyIfStill === undefined || JSON.stringify(cur) === JSON.stringify(onlyIfStill)
            ? wk.windows
            : cur,
        );
        setWeeklyFailed(false);
      } catch {
        // A failed weekly read must NOT render as an empty pattern (the
        // success-empty-for-failure class): the section says it could not
        // load, and the draft stands.
        setWeeklyFailed(true);
      }
    },
    [sellerId],
  );

  const load = useCallback(async () => {
    if (!sellerId) return;
    setState((s) => (s === 'READY' ? 'STALE' : 'LOADING'));
    try {
      const r = await api<OverridePage>(`/seller/availability-overrides?limit=50`, { sellerId });
      setOverrides(r.data);
      setHasMore(r.has_more);
      setLoaded(true);
      setLoadProblem(null);
      setState('READY');
    } catch (e) {
      if (e instanceof ApiError) {
        setLoadProblem(e.problem);
        setState(stateFromProblem(e.problem));
      } else setState('TRANSPORT_ERROR');
    }
  }, [sellerId]);

  useEffect(() => {
    void loadWindows();
    void load();
  }, [load, loadWindows]);

  const loadPast = async () => {
    if (!sellerId) return;
    setPastOpen((o) => !o);
    if (past !== null) return;
    try {
      // The server's default window starts today; past closures need an
      // explicit `from`. They accumulate at ~ten a year and are the answer
      // to "why did nobody reply on the 27th" (S11), so they stay readable.
      const r = await api<OverridePage>(`/seller/availability-overrides?from=2020-01-01&limit=50`, {
        sellerId,
      });
      const today = new Date().toISOString().slice(0, 10);
      setPast(r.data.filter((o) => o.date < today));
    } catch (e) {
      // NOT setPast([]): rendering the success-empty state for a failed
      // fetch is the purest C-5 class. past stays null, so toggling the
      // disclosure again retries; the failure shows as the banner.
      setPastOpen(false);
      if (e instanceof ApiError) setProblem(e);
    }
  };

  const saveWeekly = async () => {
    if (!sellerId) return;
    setFieldError(null);
    setSaved(false);
    for (const w of windows) {
      if (!HHMM.test(w.opens_at) || !HHMM.test(w.closes_at) || w.opens_at >= w.closes_at) {
        setFieldError(en['console.store.availability.window_invalid']);
        return;
      }
      const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
      if (minutes(w.closes_at) - minutes(w.opens_at) < 60) {
        // The DATABASE enforces this (0005: >= 1 hour) and the unmapped
        // 23514 renders as a retryable 500 -- the pass's B1. The rule is
        // S11's, said here before the wire is spent.
        setFieldError(en['console.store.availability.window_too_short']);
        return;
      }
    }
    setBusy(true);
    setProblem(null);
    try {
      // Whole-set replace; an empty set is a valid closed pattern.
      const sent = windows;
      await api(`/seller/availability`, { method: 'PUT', sellerId, body: { windows: sent } });
      setSaved(true);
      // Read the saved pattern back -- the proof the write landed, now that a
      // GET exists. Guarded: it replaces the draft only if the seller has not
      // edited since the save left (pass M2/M3 class).
      void loadWindows(sent);
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const addOverride = async () => {
    if (!sellerId) return;
    setFieldError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      setFieldError(en['console.store.availability.date_required']);
      return;
    }
    // The spec's VALIDATION state: a date already overridden. The server
    // would silently upsert; the screen refuses so the seller learns the
    // date is already marked instead of wondering why nothing changed.
    if (overrides.some((o) => o.date === newDate)) {
      setFieldError(en['console.store.availability.date_already_closed']);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await api(`/seller/availability-overrides/${newDate}`, {
        method: 'PUT',
        sellerId,
        body: newNote.trim() ? { note: newNote.trim() } : {},
      });
      setNewDate('');
      setNewNote('');
      void load();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const removeOverride = async (date: string) => {
    if (!sellerId) return;
    setBusy(true);
    setProblem(null);
    try {
      await api(`/seller/availability-overrides/${date}`, { method: 'DELETE', sellerId });
      void load();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const addWindow = (weekday: number) => {
    setWindows((w) => [...w, { weekday, opens_at: '09:00', closes_at: '17:00' }]);
  };
  const editWindow = (i: number, field: 'opens_at' | 'closes_at', value: string) => {
    setWindows((w) => w.map((win, j) => (j === i ? { ...win, [field]: value } : win)));
  };
  const dropWindow = (i: number) => {
    setWindows((w) => w.filter((_, j) => j !== i));
  };

  if (state === 'NO_PERMISSION') return null;
  if (!loaded && state !== 'READY' && state !== 'STALE') {
    return (
      <ScreenState
        state={state}
        onRetry={() => void load()}
        {...(loadProblem ? { problem: loadProblem } : {})}
      />
    );
  }

  return (
    <section aria-labelledby="availability-heading" data-screen="SC-19" className="availability">
      <h1 id="availability-heading">{en['console.store.availability.heading']}</h1>

      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {loaded && state === 'TRANSPORT_ERROR' ? (
        <p className="problem" role="alert">
          {en['console.common.refetch_failed']}
        </p>
      ) : null}
      {fieldError ? (
        <p className="field-error" role="alert">
          {fieldError}
        </p>
      ) : null}
      {saved ? <p className="callout">{en['console.store.availability.saved']}</p> : null}

      {/* The one job this data has, stated so nobody treats it as a gate. */}
      <p className="callout">{en['console.store.availability.gates_nothing']}</p>

      <section aria-labelledby="weekly-heading" className="weekly-pattern">
        <h2 id="weekly-heading">{en['console.store.availability.weekly_heading']}</h2>
        {weeklyFailed ? (
          // A failed weekly read is a FAILURE, never a blank pattern (the
          // success-empty class). The grid below still edits and saves.
          <p className="problem" role="alert">
            {en['console.common.refetch_failed']}
          </p>
        ) : null}
        {WEEKDAYS.map((d) => {
          const dayWindows = windows
            .map((w, i) => ({ ...w, i }))
            .filter((w) => w.weekday === d.day);
          return (
            <div key={d.day} className="weekday-row">
              <h3>{d.label}</h3>
              {dayWindows.length === 0 ? (
                <p className="hint">{en['console.store.availability.no_hours']}</p>
              ) : (
                dayWindows.map((w) => (
                  <div key={w.i} className="window-row">
                    <label htmlFor={`opens-${w.i}`} className="visually-hidden">
                      {en['console.store.availability.opens_at']}
                    </label>
                    <input
                      id={`opens-${w.i}`}
                      type="time"
                      value={w.opens_at}
                      onChange={(e) => editWindow(w.i, 'opens_at', e.target.value)}
                    />
                    <label htmlFor={`closes-${w.i}`} className="visually-hidden">
                      {en['console.store.availability.closes_at']}
                    </label>
                    <input
                      id={`closes-${w.i}`}
                      type="time"
                      value={w.closes_at}
                      onChange={(e) => editWindow(w.i, 'closes_at', e.target.value)}
                    />
                    <button type="button" className="button" onClick={() => dropWindow(w.i)}>
                      {en['console.store.availability.remove_window']}
                    </button>
                  </div>
                ))
              )}
              <button type="button" className="button" onClick={() => addWindow(d.day)}>
                {en['console.store.availability.add_window']}
              </button>
            </div>
          );
        })}
        <button type="button" className="button primary" disabled={busy} onClick={() => void saveWeekly()}>
          {en['console.store.availability.save_weekly']}
        </button>
      </section>

      <section aria-labelledby="overrides-heading" className="overrides">
        <h2 id="overrides-heading">{en['console.store.availability.overrides_heading']}</h2>
        <p>{en['console.store.availability.overrides_explain']}</p>
        {overrides.length === 0 ? (
          <p className="empty" data-state="EMPTY">
            {en['console.store.availability.overrides_empty']}
          </p>
        ) : (
          <ul className="override-list">
            {overrides.map((o) => (
              <li key={o.date}>
                <span>{o.date}</span>
                {o.note ? <span className="override-note">{o.note}</span> : null}
                <button type="button" className="button" disabled={busy} onClick={() => void removeOverride(o.date)}>
                  {en['console.store.availability.remove_override']}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="form-block">
          <label htmlFor="ov-date">{en['console.store.availability.new_date']}</label>
          <input
            id="ov-date"
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
          <label htmlFor="ov-note">{en['console.store.availability.new_note']}</label>
          <input id="ov-note" maxLength={120} value={newNote} onChange={(e) => setNewNote(e.target.value)} />
          <button type="button" className="button" disabled={busy} onClick={() => void addOverride()}>
            {en['console.store.availability.add_override']}
          </button>
        </div>

        {hasMore ? <p className="hint">{en['console.store.availability.overrides_more']}</p> : null}
        <button type="button" className="button" aria-expanded={pastOpen} onClick={() => void loadPast()}>
          {en['console.store.availability.past_toggle']}
        </button>
        {pastOpen && past !== null ? (
          past.length === 0 ? (
            <p className="hint">{en['console.store.availability.past_empty']}</p>
          ) : (
            <ul className="override-list past">
              {past.map((o) => (
                <li key={o.date}>
                  <span>{o.date}</span>
                  {o.note ? <span className="override-note">{o.note}</span> : null}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>
    </section>
  );
}
