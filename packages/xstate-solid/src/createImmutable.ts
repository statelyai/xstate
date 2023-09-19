import type { Store } from 'solid-js/store';
import { createStore } from 'solid-js/store';
import { deepClone, isWrappable } from './deepClone.ts';
import { batch } from 'solid-js';

const resolvePath = (path: any[], obj = {}): unknown => {
  let current: any = obj;
  // tslint:disable-next-line:prefer-for-of
  for (let i = 0; i < path.length; i++) {
    current = current?.[path[i]];
  }
  return current;
};

const updateStore = <Path extends unknown[]>(
  nextStore: Store<any>,
  prevStore: Store<any>,
  set: (...args: [...Path, unknown, unknown?]) => void,
  store: Store<any>
) => {
  const valueRefs = new WeakMap<any, unknown>();
  const diff = <CompareValue extends unknown>(
    next: CompareValue,
    prev: CompareValue,
    path: Path
  ) => {
    if (prev === next) {
      return;
    }

    // Use reference if it has already been used circular reference loops
    if (valueRefs.has(next)) {
      set(...path, valueRefs.get(next));
      return;
    }

    if (!isWrappable(next) || !isWrappable(prev)) {
      // toString cannot be set in solid stores
      if (path[path.length - 1] !== 'toString') {
        set(...path, () => next);
      }
      return;
    }

    // next is either an object or array, save reference to prevent diffing
    // the same object twice
    valueRefs.set(next, resolvePath(path, store));

    // Diff and update array or object
    if (Array.isArray(next) && Array.isArray(prev)) {
      const newIndices = next.length - prev.length;
      const smallestSize = Math.min(prev.length, next.length);
      const largestSize = Math.max(next.length, prev.length);

      // Diff array
      for (let start = 0, end = largestSize - 1; start < end; start++, end--) {
        diff(next[start], prev[start], [...path, start] as Path);
        diff(next[end], prev[end], [...path, end] as Path);
      }

      // Update new or now undefined indexes
      if (newIndices !== 0) {
        for (let newEnd = smallestSize; newEnd <= largestSize - 1; newEnd++) {
          set(...path, newEnd, next[newEnd]);
        }
        if (prev.length > next.length) {
          set(...path, 'length', next.length);
        }
      }
    } else {
      // Update new values
      const targetKeys = Object.keys(next) as Array<keyof CompareValue>;
      for (let i = 0, len = targetKeys.length; i < len; i++) {
        diff(next[targetKeys[i]!], prev[targetKeys[i]!], [
          ...path,
          targetKeys[i]
        ] as Path);
      }

      // Remove previous keys that are now undefined
      const previousKeys = Object.keys(prev) as Array<keyof CompareValue>;
      for (let i = 0, len = previousKeys.length; i < len; i++) {
        if (next[previousKeys[i]!] === undefined) {
          set(...path, previousKeys[i]!, undefined);
        }
      }
    }
  };
  diff(nextStore, prevStore, [] as any);
};

/**
 * Based on Ryan Carniato's createImmutable prototype
 * Clones the initial value and diffs updates
 */
export function createImmutable<T extends object>(
  init: T
): [T, (next: T) => void] {
  const [store, setStore] = createStore(deepClone(init));
  let ref = init;

  const setImmutable = (next: T) => {
    batch(() => {
      updateStore(next, ref, setStore, store);
    });
    ref = next;
  };

  return [store, setImmutable];
}
