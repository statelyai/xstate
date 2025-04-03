import { toObserver } from './toObserver';
import {
  AnyAtom,
  Atom,
  Observer,
  Readable,
  ReadonlyAtom,
  Subscription
} from './types';

interface AtomOptions<T> {
  compare?: (prev: T, next: T) => boolean;
}

export function createAtom<T>(
  getValue: (read: <U>(atom: Readable<U>) => U) => T,
  options?: AtomOptions<T>
): ReadonlyAtom<T>;
export function createAtom<T>(initialValue: T): Atom<T>;
export function createAtom<T>(
  valueOrFn: T | ((read: <U>(atom: Readable<U>) => U) => T),
  options?: AtomOptions<T>
): Atom<T> | ReadonlyAtom<T> {
  const current = { value: undefined as T };
  let observers: Set<Observer<T>> | undefined;
  const dependencies = new Set<AnyAtom>();
  const dependents = new Set<AnyAtom>();

  const self = {
    dependencies,
    dependents,
    state: 'clean' as const
  } as unknown as Atom<T>;

  // Handle computed case
  if (typeof valueOrFn === 'function') {
    const subs = new Map<AnyAtom, Subscription>();
    const observedAtoms = new Set<AnyAtom>();

    const getValue = valueOrFn as (read: <U>(atom: Atom<U>) => U) => T;
    const read = (atom: AnyAtom) => {
      observedAtoms.add(atom);
      self.dependencies.add(atom);
      atom.dependents.add(self);
      const val = atom.get();
      if (subs.has(atom)) {
        return val;
      }
      return val;
    };

    // Initialize computed value
    current.value = getValue(read);
  } else {
    // Handle static value case
    current.value = valueOrFn;
  }

  const recompute = () => {
    if (typeof valueOrFn !== 'function') return;

    // self.dependencies.clear();
    self.dependencies.forEach((d) => {
      d.dependents.delete(self);
    });
    self.dependencies.clear();
    const read = (atom: AnyAtom) => {
      self.dependencies.add(atom);
      atom.dependents.add(self);
      return atom.get();
    };
    const newValue = valueOrFn(read);
    if (options?.compare?.(current.value, newValue)) {
      self.state = 'clean';
      return;
    }
    current.value = newValue;
    self.state = 'clean';
    observers?.forEach((o) => o.next?.(current.value));
  };

  Object.assign(self, {
    get: () => {
      if (self.state === 'dirty') {
        recompute();
      }
      return current.value;
    },
    set:
      typeof valueOrFn === 'function'
        ? undefined
        : (newValueOrFn) => {
            let newValue = newValueOrFn;
            if (typeof newValueOrFn === 'function') {
              newValue = (newValueOrFn as (prev: T) => T)(current.value);
            }
            if (options?.compare?.(current.value, newValue)) {
              return;
            }
            current.value = newValue as T;
            markDependentsDirty(self);
            propagate(self);
            observers?.forEach((o) => o.next?.(newValue));
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
    },
    dependencies,
    dependents,
    recompute
  });

  return self;
}

export function markDependentsDirty(
  atom: AnyAtom,
  set: Set<AnyAtom> = new Set()
) {
  atom.dependents.forEach((d) => {
    if (d.state === 'dirty') return;
    d.state = 'dirty';
    set.add(d);
    markDependentsDirty(d, set);
  });
  return set;
}

export function propagate(atom: AnyAtom) {
  const deps = [...atom.dependents];
  deps.forEach((d) => {
    d.recompute();
  });
}
