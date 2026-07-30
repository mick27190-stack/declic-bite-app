import { useEffect, useState } from 'react';

/**
 * Returns a `Date` that refreshes exactly when the clock ticks over to a new
 * minute, so time-dependent UI (opening hours, order cut-offs) updates live
 * without reloading the app. Uses a self-correcting timeout (no drift) and
 * resyncs when the tab/app returns to the foreground, since background timers
 * are throttled or frozen on mobile.
 */
export function useLiveParisTime(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timeoutId: number | undefined;

    const schedule = () => {
      const current = new Date();
      setNow(current);
      // +250ms safety margin so we land just after the minute boundary.
      const delay = 60000 - (current.getSeconds() * 1000 + current.getMilliseconds()) + 250;
      timeoutId = window.setTimeout(schedule, delay);
    };
    schedule();

    const resync = () => {
      if (document.visibilityState === 'visible') {
        if (timeoutId) window.clearTimeout(timeoutId);
        schedule();
      }
    };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('focus', resync);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('focus', resync);
    };
  }, []);

  return now;
}
