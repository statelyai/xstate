import { createStore, reconcile } from 'solid-js/store';
import { createSignal } from 'solid-js';
import { deepClone } from './deepClone.ts';
// @ts-ignore
import { createImmutable as primitiveCreateImmutable } from '@solid-primitives/immutable';

export function createImmutable<T extends object>(
  init: T
): [T, (next: T) => void] {
  const [data, setData] = createSignal(init);
  const store = primitiveCreateImmutable(data);

  return [store, setData];
}
