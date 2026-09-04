/**
 * lib/market.tsx -- the market-context provider. D-103, and it is owed BUILD
 * rather than a decision (WORK ORDER T9 S4.2).
 *
 * WHAT WAS WRONG. `GET /v1/bootstrap` carries the market's timezone, display
 * currency, the locale list and `client_status`, and the console called it
 * only to have the device cookie minted -- it read nothing back. So
 * `lib/intl.ts`, which exists to format EVERY date and amount against the
 * market (ADU-CON-03 S4.4), had no market to format against and its callers
 * passed literals; and `UPGRADE_REQUIRED`, one of the twelve states, was
 * UNREACHABLE, because the only thing that can produce it is the
 * `client_status` field nobody read.
 *
 * ONE CALL, NOT TWO. The bootstrap call moves HERE from SessionProvider
 * rather than being added beside it. The order is not incidental: bootstrap
 * mints `__Host-adulis_device` and the server reads the device from that
 * cookie, so nothing session-shaped can precede it (ADU-RUL-03 S2, D-118).
 * This provider therefore wraps the session provider, and the session probe
 * waits for `ready`.
 *
 * WHAT IT DOES NOT DO. It computes nothing. `client_status` is the SERVER's
 * verdict on this client's version; the console does not compare version
 * strings and decide for itself, which is S3.1's invariant (the client
 * computes no business state) applied to the one field that most invites it.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError } from '../api/client';
import type { AdulisProblem } from './states';
import type { MarketContext } from './intl';

type ClientStatus = 'OK' | 'UPGRADE_RECOMMENDED' | 'UPGRADE_REQUIRED';

interface BootstrapResponse {
  server_time: string;
  min_supported_client: string;
  client_status: ClientStatus;
  market: { code: string; display_currency: string; timezone: string };
  locales: string[];
  feature_flags: Record<string, boolean>;
  media_public_origin: string;
  environment: Environment;
}

/**
 * Which server answered. Read from the WIRE, never from the build.
 *
 * A build-time constant says which environment the bundle was compiled for;
 * this says which API the seller is actually talking to. The two differ
 * exactly when it matters most -- a staging bundle pointed at production, or
 * the reverse -- and a banner that can be wrong about that is worse than none.
 *
 * Older servers do not send it, so the type admits undefined and the banner
 * simply does not render. An absent banner is the pre-T23 behaviour; a banner
 * guessing "production" from an absence would be the failure.
 */
export type Environment = 'development' | 'test' | 'staging' | 'production';

interface MarketContextValue {
  /** null until the first bootstrap resolves; never guessed. */
  readonly market: MarketContext | null;
  readonly marketCode: string | null;
  readonly clientStatus: ClientStatus | null;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  /** T20 S4: public origin for product image keys; '' when storage is unconfigured. */
  readonly mediaPublicOrigin: string;
  /** Which server answered, or null before the first bootstrap resolves. */
  readonly environment: Environment | null;
  /**
   * The A5 clock reference, as the server stated it, with the moment this
   * client received it. A screen that must show "time remaining" measures
   * against this rather than against the device clock -- a phone with a wrong
   * clock is common and a countdown computed from it is wrong by hours.
   */
  readonly serverTime: { at: string; receivedAt: number } | null;
  readonly booting: boolean;
  readonly problem: AdulisProblem | null;
  refresh(): Promise<void>;
}

const Ctx = createContext<MarketContextValue | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<BootstrapResponse | null>(null);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const [booting, setBooting] = useState(true);
  const [problem, setProblem] = useState<AdulisProblem | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<BootstrapResponse>('/bootstrap');
      setData(r);
      setReceivedAt(Date.now());
      setProblem(null);
    } catch (e) {
      // A failed bootstrap is a transport failure, not signed-out: this
      // endpoint is anonymous. The app still renders -- it renders the error.
      //
      // Only an ApiError carries a problem envelope, and a fabricated one
      // would put an invented request id in front of support. A non-ApiError
      // leaves `problem` null and `market` null, which is what callers
      // already branch on.
      setProblem(e instanceof ApiError ? e.problem : null);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<MarketContextValue>(() => {
    const locale: 'en' | 'am' =
      data?.locales?.includes('am') && navigatorPrefersAmharic() ? 'am' : 'en';
    return {
      market: data
        ? { timezone: data.market.timezone, currency: data.market.display_currency, locale }
        : null,
      marketCode: data?.market.code ?? null,
      clientStatus: data?.client_status ?? null,
      featureFlags: data?.feature_flags ?? {},
      mediaPublicOrigin: data?.media_public_origin ?? '',
      environment: data?.environment ?? null,
      serverTime: data && receivedAt ? { at: data.server_time, receivedAt } : null,
      booting,
      problem,
      refresh: load,
    };
  }, [data, receivedAt, booting, problem, load]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Which locale to render. `AM_ENABLED` is off (packages/locale), so this
 * returns false today and the branch exists so the wiring is real rather
 * than notional -- the market's own locale list is what will decide, not a
 * build flag, and the server already sends it.
 */
function navigatorPrefersAmharic(): boolean {
  return false;
}

export function useMarket(): MarketContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMarket outside MarketProvider');
  return v;
}

/**
 * The market a screen formats against, or null while booting. Screens that
 * format money or time take this and render LOADING until it arrives --
 * formatting against a guessed timezone is how a handoff window shows the
 * wrong hour to a seller in the only market this ships to.
 */
export function useMarketContext(): MarketContext | null {
  return useMarket().market;
}
