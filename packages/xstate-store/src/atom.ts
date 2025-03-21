import { toObserver } from './toObserver';
import {
  AnyAtom,
  Atom,
  Observer,
  Readable,
  ReadonlyAtom,
  Subscription
} from './types';

export function createAtom<T>(
  getValue: (read: <U>(atom: Readable<U>) => U) => T
): ReadonlyAtom<T>;
export function createAtom<T>(initialValue: T): Atom<T>;
export function createAtom<T>(
  valueOrFn: T | ((read: <U>(atom: Readable<U>) => U) => T)
): Atom<T> | ReadonlyAtom<T> {
  const current = { value: undefined as T };
  let observers: Set<Observer<T>> | undefined;

  // Handle computed case
  if (typeof valueOrFn === 'function') {
    const subs = new Map<AnyAtom, Subscription>();
    let observedAtoms = new Set<AnyAtom>();

    const getValue = valueOrFn as (read: <U>(atom: Atom<U>) => U) => T;
    const read = (atom: AnyAtom) => {
      observedAtoms.add(atom);
      const val = atom.get();
      if (subs.has(atom)) {
        return val;
      }
      const sub = atom.subscribe(recompute);
      subs.set(atom, sub);
      return val;
    };

    function recompute() {
      observedAtoms = new Set();
      const newValue = getValue(read);

      // Cleanup any atoms that are no longer observed
      for (const [atom, sub] of subs) {
        if (!observedAtoms.has(atom)) {
          sub.unsubscribe();
          subs.delete(atom);
        }
      }

      current.value = newValue;
      observers?.forEach((o) => o.next?.(newValue));
    }

    // Initialize computed value
    current.value = getValue(read);
  } else {
    // Handle static value case
    current.value = valueOrFn;
  }

  return {
    get: () => current.value,
    set:
      typeof valueOrFn === 'function'
        ? undefined
        : (newValueOrFn) => {
            let newValue = newValueOrFn;
            if (typeof newValueOrFn === 'function') {
              newValue = (newValueOrFn as (prev: T) => T)(current.value);
            }
            current.value = newValue as T;
            observers?.forEach((o) => o.next?.(newValue as T));
          },
    subscribe: (observerOrFn: Observer<T> | ((value: T) => void)) => {
      const obs = toObserver(observerOrFn);
      observers ??= new Set();
      observers.add(obs);
      return {
        unsubscribe() {
          observers?.delete(obs);
        }
      };
    }
  };
}
