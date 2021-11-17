import type { StateNode } from '.';

const cache = new WeakMap<StateNode, any>();

export function memo<T>(object: any, key: string, fn: () => T): T {
  let memoizedData = cache.get(object);

  if (!memoizedData || !memoizedData[key]) {
    memoizedData = {
      ...memoizedData,
      [key]: fn()
    };

    cache.set(object, memoizedData);
  }

  return memoizedData[key];
}
