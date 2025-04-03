import { toObserver } from './toObserver';
import { AnyAtom, Atom, Observer, Readable, ReadonlyAtom } from './types';

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
    const observedAtoms = new Set<AnyAtom>();

    const getValue = valueOrFn as (read: <U>(atom: Atom<U>) => U) => T;
    const read = (atom: AnyAtom) => {
      observedAtoms.add(atom);
      self.dependencies.add(atom);
      atom.dependents.add(self);
      return atom.get();
    };

    // Initialize computed value
    current.value = getValue(read);
  } else {
    // Handle static value case
    current.value = valueOrFn;
  }

  const recompute = () => {
    if (typeof valueOrFn !== 'function' || self.state === 'clean') return;

    for (const dep of self.dependencies) {
      dep.dependents.delete(self);
    }
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
            const newValue =
              typeof newValueOrFn === 'function'
                ? (newValueOrFn as (prev: T) => T)(current.value)
                : newValueOrFn;

            if (options?.compare?.(current.value, newValue)) return;

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

export function markDependentsDirty(atom: AnyAtom) {
  for (const dependent of atom.dependents) {
    if (dependent.state === 'dirty') continue;
    dependent.state = 'dirty';
    markDependentsDirty(dependent);
  }
}

export function propagate(atom: AnyAtom) {
  for (const dependent of atom.dependents) {
    dependent.recompute();
  }
}
