import { createStore } from 'solid-js/store';
import type { SetStoreFunction } from 'solid-js/store/types';
import { deepClone } from './deepClone';
import { batch } from 'solid-js';

export function isWrappable(obj: any): obj is object {
  let proto;
  return (
    obj != null &&
    typeof obj === 'object' &&
    (!(proto = Object.getPrototypeOf(obj)) ||
      proto === Object.prototype ||
      Array.isArray(obj))
  );
}

function diff<N extends any>(
  next: N,
  prev: N,
  path: [],
  set: SetStoreFunction<any>
) {
  if (
    prev === next ||
    typeof prev === 'function' ||
    typeof next === 'function'
  ) {
    return;
  }

  if (!isWrappable(next) || !isWrappable(prev)) {
    set(...path, next);
    return;
  }

  if (Array.isArray(next) && Array.isArray(prev)) {
    const newIndices = next.length - prev.length;
    const smallestSize = Math.min(prev.length, next.length);
    const largestSize = Math.max(next.length, prev.length);

    for (let start = 0, end = smallestSize - 1; start < end; start++, end--) {
      diff(next[start], prev[start], [...path, start] as any, set);
      diff(next[end], prev[end], [...path, end] as any, set);
    }
    if (newIndices !== 0) {
      for (let newEnd = smallestSize; newEnd <= largestSize - 1; newEnd++) {
        set(...path, newEnd, next[newEnd]);
      }
      if (prev.length > next.length) {
        set(...path, 'length', next.length);
      }
    }
    return;
  }
  const targetKeys = Object.keys(next) as Array<keyof N>;
  for (let i = 0, len = targetKeys.length; i < len; i++) {
    diff(
      next[targetKeys[i]!],
      prev[targetKeys[i]!],
      [...path, targetKeys[i]] as any,
      set
    );
  }

  const previousKeys = Object.keys(prev) as Array<keyof N>;
  for (let i = 0, len = previousKeys.length; i < len; i++) {
    if (next[previousKeys[i]!] === undefined) {
      set(...path, previousKeys[i]!, undefined);
    }
  }
}

export function createImmutable<T extends object | []>(
  init: T
): [T, (next: T) => void] {
  const [store, setStore] = createStore(deepClone(init));
  let ref = init;

  const setImmutable = (next: T) => {
    if (typeof next === 'function') {
      next = next(store);
    }
    batch(() => {
      diff(next, ref, [], setStore);
    });
    ref = next;
  };

  return [store, setImmutable];
}
