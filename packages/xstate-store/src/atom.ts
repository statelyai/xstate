import { toObserver } from './store';
import { Observer, Subscribable, Subscription } from './types';

interface Atom<T> extends Subscribable<T> {
  get(): T;
  set(value: T): void;
  set(fn: (prevVal: T) => T): void;
}

export function createAtom<T>(initialValue: T): Atom<T> {
  const current = {
    value: initialValue
  };
  let observers: Set<Observer<T>> | undefined;

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
        }
      };
    }
  };
}

export function createAtomComputed<T>(
  getValue: (read: <U>(atom: Atom<U>) => U) => T
): Atom<T> {
  const subs = new Map<Atom<any>, Subscription>();
  const read = (atom: Atom<any>) => {
    const val = atom.get();
    if (subs.get(atom)) {
      return val;
    }
    const sub = atom.subscribe(recompute);
    subs.set(atom, sub);
    return val;
  };
  const current = {
    value: getValue(read)
  };
  function recompute() {
    current.value = getValue(read);
    observers?.forEach((o) => o.next?.(current.value));
  }

  let observers: Set<Observer<T>> | undefined;

  return {
    get: () => current.value,
    set: (newValueOrFn) => {
      if (typeof newValueOrFn === 'function') {
        const newValue = (newValueOrFn as any)(current.value);
        current.value = newValue;
      } else {
        current.value = newValueOrFn;
      }
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

// lawful good: TItem
// neutral: T
// chaotic neutral: t
// Item
// item
