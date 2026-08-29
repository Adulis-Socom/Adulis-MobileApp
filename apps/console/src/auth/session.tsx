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
import { api, ApiError } from '../api/client';

/** ADU-VAL-01 S3 defaults; D-96 owes the real per-market values a field. */
const IDLE_MS_UNREMEMBERED = 30 * 60 * 1000;
const IDLE_MS_REMEMBERED = 8 * 60 * 60 * 1000;
const WARN_BEFORE_MS = 5 * 60 * 1000;

export interface SessionInfo {
  readonly accountId: string;
  readonly expiresAt: string;
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
  signedIn(s: SessionInfo): void;
  signedOut(): void;
  touch(): void;
}

const Ctx = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [booting, setBooting] = useState(true);
  const [idleWarningAt, setIdleWarningAt] = useState<number | null>(null);
  const lastActivity = useRef<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api<{ data: SessionRow[] }>('/auth/sessions');
        const current = r.data.find((s) => s.current);
        if (!cancelled && current) {
          setSession({
            accountId: '',
            expiresAt: current.expires_at,
            remembered: current.remembered,
          });
        }
      } catch (e) {
        // 401 = signed out; anything else also lands on the sign-in screen,
        // which owns the error presentation.
        void e;
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const touch = useCallback(() => {
    lastActivity.current = Date.now();
    setIdleWarningAt(null);
  }, []);

  // The warning clock. Driven from USER ACTIVITY (the server's idle clock
  // runs from the last REQUEST; a fully quiet client makes none, so local
  // activity is the honest proxy for "about to go idle").
  useEffect(() => {
    if (!session) return undefined;
    const idleMs = session.remembered ? IDLE_MS_REMEMBERED : IDLE_MS_UNREMEMBERED;
    const t = window.setInterval(() => {
      const idleFor = Date.now() - lastActivity.current;
      if (idleFor >= idleMs - WARN_BEFORE_MS) {
        setIdleWarningAt(lastActivity.current + idleMs);
      }
    }, 15_000);
    const onActivity = () => {
      lastActivity.current = Date.now();
    };
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('keydown', onActivity);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
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
      touch,
    }),
    [session, booting, idleWarningAt, touch],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

/** Keep the session warm: any successful API call counts as activity server-side. */
export async function keepAlive(): Promise<void> {
  try {
    await api<{ data: SessionRow[] }>('/auth/sessions');
  } catch (e) {
    if (e instanceof ApiError && e.problem.status === 401) throw e;
  }
}
