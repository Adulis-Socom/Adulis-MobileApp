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
    AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => {
        if (live) setReduce(enabled);
      },
      () => undefined,
    );
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}
