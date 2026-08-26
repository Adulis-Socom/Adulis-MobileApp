import { en } from '@adulis/locale';

/**
 * TIER 0 placeholder — a single route rendering one line.
 *
 * The console is COO/CTO scope (.claude/reference/ENGINEERING_SPLIT.md). This
 * back-end session builds only enough for it to compile, build and be deployed
 * by CI. React Router 7, TanStack Query 5, Tailwind 4 and the generated API
 * client are NOT installed here — they arrive with the front-end's own work.
 *
 * When routing lands, the seller id lives in the URL (/s/:sellerId/...) so that
 * two stores in two tabs are two URLs, which makes the two-tab bug of
 * ADU-AUTH-01 section 8.3 structurally impossible (ADU-CON-02 section 3.9).
 */
export function App(): React.JSX.Element {
  return (
    <main>
      <h1>{en['app.title']}</h1>
      <p>Adulis Seller Console — see ADU-CON-03</p>
    </main>
  );
}
