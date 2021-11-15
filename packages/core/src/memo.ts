import type { StateNode } from '.';

const stateNodeMap = new WeakMap<StateNode, any>();

export function getMemo<T>(
  stateNode: StateNode<any, any>,
  key: string
): T | undefined {
  return stateNodeMap.get(stateNode)?.[key];
}

export function memo<T>(
  stateNode: StateNode<any, any>,
  key: string,
  fn: () => T
): T {
  let memoizedData = stateNodeMap.get(stateNode);

  if (!memoizedData || !memoizedData[key]) {
    memoizedData = {
      ...memoizedData,
      [key]: fn()
    };

    stateNodeMap.set(stateNode, memoizedData);
  }

  return memoizedData[key];
}
