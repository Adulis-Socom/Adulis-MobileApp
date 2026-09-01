/**
 * features/admin/NotificationPrefs.tsx -- SC-28 Notification preferences
 * (v1.2 S12, R22).
 *
 * R22: EIGHT CATEGORIES, ENUMERATED -- seven in a grouped control, the
 * locked one OUTSIDE it, visibly disabled with its reason, because a seller
 * looking for the setting should find an explanation rather than an absence.
 * Category 8 is locked for ACCOUNT SECURITY, not importance
 * (suppressible=false at the database, always includes SMS).
 *
 * THE SERVER HOLDS NO CATEGORY LIST (register D-224): GET returns only the
 * {template_key, enabled} rows this account has written, and the sender
 * suppresses by TEMPLATE KEY. The categories here transcribe R22's table;
 * the keys under them are THE SERVER'S OWN, verbatim from the writers that
 * exist today: ORDER_AWAITING_PAYMENT_MORNING (payments),
 * STOCK_CONFIDENCE_NUDGE (stock), NEW_DEVICE_SIGNIN + PAYOUT_CHANGE_*
 * (locked, category 8). Five categories have NO SENDER YET -- their toggle
 * renders DISABLED with a line saying the alerts are not sent yet, because a
 * switch wired to nothing is a lie (writing a preference under an INVENTED
 * key would be the console defining the server's vocabulary -- the D-98
 * inversion). Toggling a locked key anyway would earn the server's 422
 * NOT_SUPPRESSIBLE; this screen never offers the attempt.
 *
 * R22's category-2 rule: Payments stays TOGGLEABLE, and the consequence
 * renders AT THE MOMENT it is switched off -- missing the 24-hour window
 * loses the sale and draws a SYSTEM claim -- rather than taking the choice
 * away.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import { ScreenState } from '../../components/ScreenState';
import type { UiState } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import type { NotificationPreference } from './types';

interface Category {
  readonly key: string;
  readonly title: string;
  readonly covers: string;
  /** The server's template keys under this category; empty = no sender yet. */
  readonly templateKeys: readonly string[];
}

const CATEGORIES: readonly Category[] = [
  {
    key: 'orders',
    title: en['console.admin.notifprefs.cat_orders'],
    covers: en['console.admin.notifprefs.cat_orders_covers'],
    templateKeys: [],
  },
  {
    key: 'payments',
    title: en['console.admin.notifprefs.cat_payments'],
    covers: en['console.admin.notifprefs.cat_payments_covers'],
    templateKeys: ['ORDER_AWAITING_PAYMENT_MORNING'],
  },
  {
    key: 'handoff',
    title: en['console.admin.notifprefs.cat_handoff'],
    covers: en['console.admin.notifprefs.cat_handoff_covers'],
    templateKeys: [],
  },
  {
    key: 'messages',
    title: en['console.admin.notifprefs.cat_messages'],
    covers: en['console.admin.notifprefs.cat_messages_covers'],
    templateKeys: [],
  },
  {
    key: 'reviews',
    title: en['console.admin.notifprefs.cat_reviews'],
    covers: en['console.admin.notifprefs.cat_reviews_covers'],
    templateKeys: [],
  },
  {
    key: 'level',
    title: en['console.admin.notifprefs.cat_level'],
    covers: en['console.admin.notifprefs.cat_level_covers'],
    templateKeys: [],
  },
  {
    key: 'stock',
    title: en['console.admin.notifprefs.cat_stock'],
    covers: en['console.admin.notifprefs.cat_stock_covers'],
    templateKeys: ['STOCK_CONFIDENCE_NUDGE'],
  },
];

export function NotificationPrefs() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [prefs, setPrefs] = useState<readonly NotificationPreference[] | null>(null);
  const [state, setState] = useState<UiState>('LOADING');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  // The box flips at the CLICK -- a toggle that waits for the round-trip
  // reads as dead (the C-6 pass-in-progress found Playwright refusing it for
  // exactly that reason). This is form state, not business state: the server
  // reconciles on the next load, and a failed PATCH reverts it with the
  // banner saying why.
  const [flips, setFlips] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!sellerId) return;
    setState((s) => (s === 'READY' ? 'STALE' : 'LOADING'));
    try {
      const r = await api<{ preferences: NotificationPreference[] }>(
        `/seller/notification-preferences`,
        { sellerId },
      );
      setPrefs(r.preferences);
      setFlips({});
      setState('READY');
    } catch (e) {
      setState(e instanceof ApiError ? stateFromProblem(e.problem) : 'TRANSPORT_ERROR');
    }
  }, [sellerId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Default is ON (R22's table); a written row overrides it. */
  const isEnabled = (cat: Category): boolean => {
    const flipped = flips[cat.key];
    if (flipped !== undefined) return flipped;
    if (!prefs) return true;
    return cat.templateKeys.every((k) => prefs.find((p) => p.template_key === k)?.enabled ?? true);
  };

  const toggle = async (cat: Category, enabled: boolean) => {
    if (!sellerId || cat.templateKeys.length === 0) return;
    setFlips((f) => ({ ...f, [cat.key]: enabled }));
    setBusy(true);
    setProblem(null);
    try {
      await api(`/seller/notification-preferences`, {
        method: 'PATCH',
        sellerId,
        body: { preferences: cat.templateKeys.map((k) => ({ template_key: k, enabled })) },
      });
      void load();
    } catch (e) {
      // The write failed: the box goes BACK and the banner says why --
      // a toggle that stays flipped over a refused write is a lie.
      setFlips((f) => {
        const next = { ...f };
        delete next[cat.key];
        return next;
      });
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  if (state === 'NO_PERMISSION') return null;
  if (!prefs) return <ScreenState state={state} onRetry={() => void load()} />;

  return (
    <section aria-labelledby="notifprefs-heading" data-screen="SC-28" className="notif-prefs">
      <h1 id="notifprefs-heading">{en['console.admin.notifprefs.heading']}</h1>

      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {state === 'TRANSPORT_ERROR' ? (
        <p className="problem" role="alert">
          {en['console.common.refetch_failed']}
        </p>
      ) : null}

      <fieldset>
        <legend>{en['console.admin.notifprefs.legend']}</legend>
        {CATEGORIES.map((cat) => {
          const wired = cat.templateKeys.length > 0;
          const enabled = isEnabled(cat);
          return (
            <div key={cat.key} className="pref-row">
              <label htmlFor={`pref-${cat.key}`}>
                <strong>{cat.title}</strong>
                <span className="pref-covers">{cat.covers}</span>
              </label>
              <input
                id={`pref-${cat.key}`}
                type="checkbox"
                checked={enabled}
                disabled={busy || !wired}
                onChange={(e) => void toggle(cat, e.target.checked)}
              />
              {!wired ? (
                // A switch wired to nothing is a lie -- say why it waits.
                <p className="hint">{en['console.admin.notifprefs.not_sent_yet']}</p>
              ) : null}
              {cat.key === 'payments' && !enabled ? (
                // R22: the consequence, at the moment of the choice.
                <p className="warn" role="alert">
                  {en['console.admin.notifprefs.payments_off_warning']}
                </p>
              ) : null}
            </div>
          );
        })}
      </fieldset>

      {/* The locked row, OUTSIDE the grouped control (R22). */}
      <div className="pref-row locked" data-state="NO_ENTITLEMENT">
        <label htmlFor="pref-security">
          <strong>{en['console.admin.notifprefs.cat_security']}</strong>
          <span className="pref-covers">{en['console.admin.notifprefs.cat_security_covers']}</span>
        </label>
        <input id="pref-security" type="checkbox" checked disabled />
        <p className="hint">{en['console.admin.notifprefs.locked_reason']}</p>
      </div>
    </section>
  );
}
