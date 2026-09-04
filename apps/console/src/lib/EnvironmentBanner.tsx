/**
 * lib/EnvironmentBanner.tsx -- which server this is, said in words, on every
 * screen including the one you sign in on (T23 Phase 4).
 *
 * THE FAILURE IT PREVENTS is not confusion in the abstract. Staging is a real
 * server on the internet with no confidentiality: it is invite-only, it
 * carries no real seller, and it is not publicly linked -- but anyone who can
 * reach its logs can sign in as anyone. A seller who believes they are on
 * production types a real phone number, real bank details and a real
 * identity document into it. The banner exists so that mistake requires
 * ignoring a sentence rather than merely not knowing one.
 *
 * IT RENDERS ABOVE THE ROUTER, NOT INSIDE THE SHELL, and that placement is
 * the point: sign-in (SC-00) is outside the shell, and sign-in is exactly
 * where the wrong-server mistake is made and is most expensive.
 *
 * PRODUCTION RENDERS NOTHING. A banner that appears everywhere is a banner
 * nobody reads, and "you are on production" is the one thing a seller can
 * safely assume from the absence of a warning.
 *
 * RULE 4 (no colour alone, ADU-CON-03 S7): the environment is a WORD. The
 * tone is decoration that survives greyscale, a monochrome display and the
 * mode you do not develop in; the sentence is what carries the meaning.
 */
import { useMarket } from './market';

/** What each non-production environment must say for itself. */
const SAID: Record<string, { name: string; meaning: string }> = {
  staging: {
    name: 'Staging',
    meaning:
      'This is a test server. Nothing here is real: no order is a real order, no payout ' +
      'reaches a bank, and anyone with access can read what you type. Do not enter a real ' +
      'bank account or a real identity document.',
  },
  development: {
    name: 'Development',
    meaning: 'A developer machine. Nothing here is real and nothing here is kept.',
  },
  test: {
    name: 'Test',
    meaning: 'An automated test run. Nothing here is real and nothing here is kept.',
  },
};

export function EnvironmentBanner() {
  const { environment } = useMarket();

  /*
   * NOTHING UNTIL THE SERVER HAS SAID, and nothing for production.
   *
   * `environment` is null before the first bootstrap resolves and on a server
   * too old to send it. Both render nothing -- a banner that GUESSED from an
   * absence would eventually warn about the wrong server, which is worse than
   * the silence it replaced.
   */
  if (!environment || environment === 'production') return null;
  const said = SAID[environment];
  if (!said) return null;

  return (
    <div className="env-banner" data-environment={environment} role="status">
      <strong>{said.name}</strong> <span>{said.meaning}</span>
    </div>
  );
}
