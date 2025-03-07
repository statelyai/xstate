import { toObserver } from './toObserver';
import { Observer, Subscribable, Subscription } from './types';

interface Atom<T> extends Subscribable<T> {
  get(): T;
  set(value: T): void;
  set(fn: (prevVal: T) => T): void;
}

// Function overloads
export function createAtom<T>(initialValue: T): Atom<T>;
export function createAtom<T>(
  getValue: (read: <U>(atom: Atom<U>) => U) => T
): Atom<T>;
export function createAtom<T>(
  valueOrFn: T | ((read: <U>(atom: Atom<U>) => U) => T)
): Atom<T> {
  const current = { value: undefined as T };
  let observers: Set<Observer<T>> | undefined;
  const subs = new Map<Atom<any>, Subscription>();

  // Handle computed case
  if (typeof valueOrFn === 'function') {
    const getValue = valueOrFn as (read: <U>(atom: Atom<U>) => U) => T;
    const read = (atom: Atom<any>) => {
      const val = atom.get();
      if (subs.get(atom)) {
        return val;
      }
      const sub = atom.subscribe(recompute);
      subs.set(atom, sub);
      return val;
    };

    function recompute() {
      current.value = getValue(read);
      observers?.forEach((o) => o.next?.(current.value));
    }

    // Initialize computed value
    current.value = getValue(read);
  } else {
    // Handle static value case
    current.value = valueOrFn;
  }

  return {
    get: () => current.value,
    set: (newValueOrFn) => {
      let newValue = newValueOrFn;
      if (typeof newValueOrFn === 'function') {
        newValue = (newValueOrFn as any)(current.value);
      }
      current.value = newValue as T;
      observers?.forEach((o) => o.next?.(current.value));
    },
    subscribe: (observerOrFn: Observer<T> | ((value: T) => void)) => {
      const obs = toObserver(observerOrFn);
      observers ??= new Set();
      observers.add(obs);
      return {
        unsubscribe() {
          observers?.delete(obs);
          if (typeof valueOrFn === 'function') {
            subs.forEach((sub) => sub.unsubscribe());
            subs.clear();
          }
        }
      };
    }
  };
}
