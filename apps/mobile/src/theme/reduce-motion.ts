import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the person asked the system to reduce motion (BUY-04). False until the platform answers, and when it
 * cannot. Any motion the app itself starts must follow it; transitions drawn by the navigator and the platform's
 * own spinners are the platform's to reduce.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    let heard = false; // a change event that arrives first is newer than the first answer
    AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => {
        if (live && !heard) setReduce(enabled);
      },
      () => undefined,
    );
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      heard = true;
      setReduce(enabled);
    });
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}
