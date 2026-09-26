import { useMemo } from 'react';

/**
 * Returns an object whose identity changes only when React Fast Refresh
 * re-renders the calling component. Fast Refresh ignores dependency lists
 * while it applies an update, so a `useMemo` with no dependencies recomputes
 * during a refresh and at no other time.
 */
export function useFastRefreshSignal(): object {
  return useMemo(() => ({}), []);
}
