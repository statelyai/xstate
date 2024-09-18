// Copied from https://github.com/facebook/react/blob/0a76aecbfa3d493c6b97998d0444f6505f5e5365/packages/use-sync-external-store/src/useSyncExternalStoreWithSelector.js
import * as React from 'react';
const is = (a: any, b: any) => a === b;
import { useSyncExternalStore } from 'react';

const { useRef, useEffect, useMemo, useDebugValue } = React;

// Same as useSyncExternalStore, but supports selector and isEqual arguments.
export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (arg: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: void | null | (() => Snapshot),
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean
): Selection {
  const instRef = useRef<
    | {
        hasValue: true;
        value: Selection;
      }
    | {
        hasValue: false;
        value: null;
      }
    | null
  >(null);
  let inst;
  if (instRef.current === null) {
    inst = {
      hasValue: false as const,
      value: null
    };
    instRef.current = inst;
  } else {
    inst = instRef.current;
  }

  const [getSelection, getServerSelection] = useMemo(() => {
    let hasMemo = false;
    let memoizedSnapshot: Snapshot;
    let memoizedSelection: Selection;
    const memoizedSelector = (nextSnapshot: Snapshot) => {
      if (!hasMemo) {
        hasMemo = true;
        memoizedSnapshot = nextSnapshot;
        const nextSelection = selector(nextSnapshot);
        if (isEqual !== undefined) {
          if (inst.hasValue) {
            const currentSelection = inst.value;
            if (isEqual(currentSelection, nextSelection)) {
              memoizedSelection = currentSelection;
              return currentSelection;
            }
          }
        }
        memoizedSelection = nextSelection;
        return nextSelection;
      }

      const prevSnapshot: Snapshot = memoizedSnapshot;
      const prevSelection: Selection = memoizedSelection;

      if (is(prevSnapshot, nextSnapshot)) {
        return prevSelection;
      }

      const nextSelection = selector(nextSnapshot);

      if (isEqual !== undefined && isEqual(prevSelection, nextSelection)) {
        memoizedSnapshot = nextSnapshot;
        return prevSelection;
      }

      memoizedSnapshot = nextSnapshot;
      memoizedSelection = nextSelection;
      return nextSelection;
    };
    const maybeGetServerSnapshot =
      getServerSnapshot === undefined ? null : getServerSnapshot;
    const getSnapshotWithSelector = () => memoizedSelector(getSnapshot());
    const getServerSnapshotWithSelector =
      maybeGetServerSnapshot === null
        ? undefined
        : () => memoizedSelector(maybeGetServerSnapshot());
    return [getSnapshotWithSelector, getServerSnapshotWithSelector];
  }, [getSnapshot, getServerSnapshot, selector, isEqual]);

  const value = useSyncExternalStore(
    subscribe,
    getSelection,
    getServerSelection
  );

  useEffect(() => {
    inst.hasValue = true;
    inst.value = value;
  }, [value]);

  useDebugValue(value);
  return value;
}
