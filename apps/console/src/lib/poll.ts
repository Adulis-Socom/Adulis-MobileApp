/**
 * lib/poll.ts -- SC-20's polling rule (ADU-CON-03 v1.2 S9): 30 seconds while
 * the tab is VISIBLE, paused when hidden. Console polling is ~26% of all
 * origin traffic (ADU-CON-02-A1), and a background tab polling forever is
 * the avoidable part -- so the pause is the point, not an optimisation.
 *
 * The callback is held in a ref: a new closure every render must not reset
 * the interval, and the interval must always call the LATEST closure.
 */
import { useEffect, useRef } from 'react';

export function usePoll(fn: () => void, ms: number): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer === null) timer = setInterval(() => fnRef.current(), ms);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        // Catch up immediately on return -- a seller flipping back after ten
        // minutes should not wait another interval for the world to update.
        fnRef.current();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ms]);
}
