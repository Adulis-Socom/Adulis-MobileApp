import { useLayoutEffect, useRef } from 'react';
import type { OpId, OpInput, OpOutput } from '../contracts/gap-sc';
import type { FixtureUi } from '../transport/select';
import type { CallContext, Transport } from '../transport/port';
import { BANNER_SENTENCE, createWorld, DEMO_CODES, FIXTURE_MARKER, FIXTURE_VERSION, PERSONAS, type World } from './world';

/**
 * Development-only fixture entry (GOV-06). Reached only through transport/select.ts behind `__FIXTURES__`.
 *
 * `?fx_delay=<sellerId>:<ms>[,<sellerId>:<ms>]` makes one Seller's responses arrive late: the isolation tests use it
 * to prove a late response never lands on another Seller's screen.
 */
function parseDelays(search: string): Record<string, number> {
  const out: Record<string, number> = {};
  const raw = new URLSearchParams(search).get('fx_delay');
  for (const part of raw ? raw.split(',') : []) {
    const [id, ms] = part.split(':');
    const n = Number(ms);
    if (id && Number.isFinite(n) && n >= 0) out[id] = n;
  }
  return out;
}

const world: World = createWorld({ now: () => Date.now(), delays: parseDelays(window.location.search) });

/** Test handle (installed only in fixture builds): revoke a capability, end the session server-side, read the call log. */
declare global {
  interface Window {
    __ADULIS_FIXTURE__?: { marker: string; version: string } & World['hooks'];
  }
}
window.__ADULIS_FIXTURE__ = { marker: FIXTURE_MARKER, version: FIXTURE_VERSION, ...world.hooks };

export const fixtureTransport: Transport = {
  send<K extends OpId>(op: K, input: OpInput<K>, ctx?: CallContext): Promise<OpOutput<K>> {
    return world.handle(op, input, ctx ?? {});
  },
};

function Banner() {
  const ref = useRef<HTMLElement>(null);
  // The sticky top bar and sidebar sit below the strip: publish its height as a custom property.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publish = () => document.documentElement.style.setProperty('--strip-h', `${el.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <aside ref={ref} className="fixture-strip" aria-label="Demonstration notice">
      <strong>{BANNER_SENTENCE}</strong> Sign-in, stores and every figure on screen are synthetic, and nothing is sent to a server.
    </aside>
  );
}

function SignInHelper({ onPick }: { onPick: (phone: string) => void }) {
  return (
    <section className="fixture-help" aria-labelledby="fx-help-title">
      <h2 id="fx-help-title">Demonstration accounts</h2>
      <p>
        These numbers and codes exist only in this demonstration build. The one-time code that signs you in is{' '}
        <code>{DEMO_CODES.ok}</code>. Use <code>{DEMO_CODES.invalid}</code> for an incorrect code, <code>{DEMO_CODES.expired}</code> for an
        expired code and <code>{DEMO_CODES.rateLimited}</code> for a rate-limited response.
      </p>
      <ul>
        {PERSONAS.map((p) => (
          <li key={p.id}>
            <button type="button" className="btn btn-quiet" onClick={() => onPick(p.phone)}>
              {p.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const fixtureUi: FixtureUi = { Banner, SignInHelper };
