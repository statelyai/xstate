import { toObserver } from './toObserver';
import {
  AnyAtom,
  Atom,
  AtomStatus,
  Observer,
  Readable,
  ReadonlyAtom
} from './types';

interface AtomOptions<T> {
  compare?: (prev: T, next: T) => boolean;
}

export const graph: {
  dependencies: WeakMap<AnyAtom, Set<AnyAtom>>;
  dependents: WeakMap<AnyAtom, Set<AnyAtom>>;
  addDependency: (atom: AnyAtom, dependent: AnyAtom) => void;
  // addDependent: (atom: AnyAtom, dependency: AnyAtom) => void;
} = {
  dependencies: new WeakMap(),
  dependents: new WeakMap(),
  addDependency: (atom, dependent) => {
    // add set if it doesn't exist
    if (!graph.dependencies.has(atom)) {
      graph.dependencies.set(atom, new Set());
    }
    graph.dependencies.get(atom)?.add(dependent);

    // add set if it doesn't exist
    if (!graph.dependents.has(dependent)) {
      graph.dependents.set(dependent, new Set());
    }
    graph.dependents.get(dependent)?.add(atom);
  }
};

export function createAtom<T>(
  getValue: (read: <U>(atom: Readable<U>) => U) => T,
  options?: AtomOptions<T>
): ReadonlyAtom<T>;
export function createAtom<T>(
  initialValue: T,
  options?: AtomOptions<T>
): Atom<T>;
export function createAtom<T>(
  valueOrFn: T | ((read: <U>(atom: Readable<U>) => U) => T),
  options?: AtomOptions<T>
): Atom<T> | ReadonlyAtom<T> {
  const compare = options?.compare ?? Object.is;
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
      graph.addDependency(self, atom);
      return atom.get();
    };

    // Initialize computed value
    current.value = getValue(read);
  } else {
    // Handle static value case
    current.value = valueOrFn;
  }

  const recompute = () => {
    if (typeof valueOrFn !== 'function' || self.status === AtomStatus.Clean)
      return;

    const dependencies = graph.dependencies.get(self);
    if (dependencies) {
      for (const dep of dependencies) {
        graph.dependents.get(dep)?.delete(self);
      }
    }

    graph.dependencies.get(self)?.clear();

    const read = (atom: AnyAtom) => {
      graph.addDependency(self, atom);
      return atom.get();
    };
    const newValue = (valueOrFn as any)(read);
    if (compare(current.value, newValue)) {
      self.status = AtomStatus.Clean;
      return;
    }
    current.value = newValue;
    self.status = AtomStatus.Clean;
    observers?.forEach((o) => o.next?.(current.value));
  };

  Object.assign(self, {
    get: () => {
      if (self.status === AtomStatus.Dirty) {
        recompute();
      }
      return current.value;
    },
    set:
      typeof valueOrFn === 'function'
        ? undefined
        : (newValueOrFn: any) => {
            const newValue =
              typeof newValueOrFn === 'function'
                ? (newValueOrFn as (prev: T) => T)(current.value)
                : newValueOrFn;

            if (compare(current.value, newValue)) return;

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
  const dependents = graph.dependents.get(atom);
  if (dependents) {
    for (const dependent of dependents) {
      if (dependent.status === AtomStatus.Dirty) continue;
      dependent.status = AtomStatus.Dirty;
      markDependentsDirty(dependent);
    }
  }
}

export function propagate(atom: AnyAtom) {
  const dependents = graph.dependents.get(atom);
  if (dependents) {
    for (const dependent of dependents) {
      dependent.recompute();
    }
  }
}
