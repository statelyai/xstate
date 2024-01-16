import { createStore, reconcile } from 'solid-js/store';
import { deepClone, isWrappable } from './deepClone.ts';

/**
 * Based on Ryan Carniato's createImmutable prototype
 * Clones the initial value and diffs updates
 */
export function createImmutable<T extends object>(
  init: T
): [T, (next: T) => void] {
  const [store, setStore] = createStore(deepClone(init));

  const setImmutable = (next: T) => {
    setStore(reconcile(deepClone(next)));
  };

  return [store, setImmutable];
}
