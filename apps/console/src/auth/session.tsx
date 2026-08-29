/**
 * auth/session.tsx -- signed-in state, inferred, never stored.
 *
 * The session credential is an httpOnly cookie the console cannot read;
 * "who am I" is a server question. On boot the provider asks
 * GET /v1/auth/sessions (the current session is flagged `current`) and a
 * 401 means signed out. Nothing about the session ever touches storage.
 *
 * THE IDLE WARNING (C-2, ADU-CON-02 v3.1 S4.3): "the client shows the idle
 * warning 5 minutes before either idle limit" -- 30 minutes unremembered,
 * 8 hours remembered. NO ENDPOINT TRANSMITS THESE VALUES (they are
 * per-market configuration in core.timing_config, and neither the verify
 * response nor /v1/bootstrap nor GET /v1/auth/sessions carries them --
 * register D-96). Until the contract grows the field, the timer uses the
 * ADU-VAL-01 S3 shipped defaults, named here as exactly that: a mistimed
 * warning in a market that retunes its config, until D-96 lands. The
 * SERVER stays the authority -- an expired session 401s whatever this
 * timer believed, and the 401 is handled.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AdulisProblem } from '../lib/states';
import { api, ApiError, requestClock, setUnauthorizedHandler } from '../api/client';

/** ADU-VAL-01 S3 defaults; D-96 owes the real per-market values a field. */
const IDLE_MS_UNREMEMBERED = 30 * 60 * 1000;
const IDLE_MS_REMEMBERED = 8 * 60 * 60 * 1000;
const WARN_BEFORE_MS = 5 * 60 * 1000;

export interface SessionInfo {
  /** The current session's id -- the only thing that can sign it out. */
  readonly id: string;
  readonly expiresAt: string;
  /**
   * SERVER TRUTH, never the sign-in checkbox. The server decides
   * remembered-ness from the __Host-adulis_device cookie it received, not
   * from the remember_device field it was sent, and the two disagree
   * whenever a device cookie is already present.
   */
  readonly remembered: boolean;
}

interface SessionRow {
  id: string;
  audience: string;
  expires_at: string;
  remembered: boolean;
  current: boolean;
}

interface SessionContextValue {
  readonly session: SessionInfo | null;
  readonly booting: boolean;
  readonly idleWarningAt: number | null;
  /** Set when the boot probe failed for a reason that is NOT "signed out". */
  readonly bootProblem: AdulisProblem | null;
  /** Re-run the boot probe; true if the server reports a current session. */
  refresh(): Promise<boolean>;
  signedIn(s: SessionInfo): void;
  signedOut(): void;
  signOut(): Promise<void>;
  touch(): void;
}

const Ctx = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [booting, setBooting] = useState(true);
  const [idleWarningAt, setIdleWarningAt] = useState<number | null>(null);
  const [bootProblem, setBootProblem] = useState<AdulisProblem | null>(null);
  const lastActivity = useRef<number>(Date.now());

  // One 401 handler for every call site: the session is gone, and no local
  // timer's opinion outranks the server saying so.
  useEffect(() => {
    setUnauthorizedHandler(() => setSession(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api<{ data: SessionRow[] }>('/auth/sessions');
        const current = r.data.find((s) => s.current);
        if (!cancelled && current) {
          setSession({
            id: current.id,
            expiresAt: current.expires_at,
            remembered: current.remembered,
          });
        }
      } catch (e) {
        // A 401 IS the answer: signed out, no problem to report. Anything
        // else -- 500, a dropped connection -- must not masquerade as one,
        // so it is kept and the sign-in screen renders it. Discarding it
        // made a Wi-Fi blip indistinguishable from an expired session.
        if (!cancelled && e instanceof ApiError && e.problem.status !== 401) {
          setBootProblem(e.problem);
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    const r = await api<{ data: SessionRow[] }>('/auth/sessions');
    const current = r.data.find((s) => s.current);
    if (!current) return false;
    setSession({
      id: current.id,
      expiresAt: current.expires_at,
      remembered: current.remembered,
    });
    setIdleWarningAt(null);
    return true;
  }, []);

  const touch = useCallback(() => {
    lastActivity.current = Date.now();
    setIdleWarningAt(null);
  }, []);

  // The warning clock, measured against the SAME event the server measures:
  // the last request. It used to reset on pointerdown/keydown, which meant a
  // seller who typed for an hour without triggering a request pushed the
  // warning far past the moment the server actually expired the session --
  // an interactive shell over a session that was already dead.
  useEffect(() => {
    if (!session) return undefined;
    const idleMs = session.remembered ? IDLE_MS_REMEMBERED : IDLE_MS_UNREMEMBERED;
    const evaluate = () => {
      const idleFor = Date.now() - Math.max(lastActivity.current, requestClock.last);
      // Both directions: it must also CLEAR when a request has restarted the
      // clock, or the banner sticks forever naming a time long past.
      setIdleWarningAt(
        idleFor >= idleMs - WARN_BEFORE_MS
          ? Math.max(lastActivity.current, requestClock.last) + idleMs
          : null,
      );
    };
    evaluate();
    const t = window.setInterval(evaluate, 15_000);
    return () => window.clearInterval(t);
  }, [session]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      booting,
      idleWarningAt,
      signedIn: (s) => {
        lastActivity.current = Date.now();
        setIdleWarningAt(null);
        setSession(s);
      },
      signedOut: () => setSession(null),
      signOut: async () => {
        // Revoke server-side, then drop local state whatever happened: a
        // failed revoke must not leave the seller looking signed in.
        try {
          if (session) await api<void>(`/auth/sessions/${session.id}`, { method: 'DELETE' });
        } finally {
          setSession(null);
          setIdleWarningAt(null);
        }
      },
      touch,
      bootProblem,
      refresh,
    }),
    [session, booting, idleWarningAt, bootProblem, touch, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

/**
 * Keep the session warm: any successful API call counts as activity
 * server-side. EVERY failure rethrows. Swallowing non-401 errors here made
 * "Stay signed in" report success on a request the server never saw -- the
 * seller was told they were safe while the session idled out underneath.
 */
export async function keepAlive(): Promise<void> {
  await api<{ data: SessionRow[] }>('/auth/sessions');
}
