const cache = new WeakMap<any, any>();

export function memo<T>(object: any, key: string, fn: () => T): T {
  let memoizedData = cache.get(object);

  if (!memoizedData) {
    memoizedData = { [key]: fn() };
    cache.set(object, memoizedData);
  } else if (!(key in memoizedData)) {
    memoizedData[key] = fn();
  }

  return memoizedData[key];
}
