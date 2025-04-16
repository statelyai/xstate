import {
  createReactiveSystem,
  Dependency,
  Subscriber,
  SubscriberFlags
} from './alien';
import { toObserver } from './toObserver';
import {
  Atom,
  AtomOptions,
  BaseAtom,
  InternalBaseAtom,
  InternalReadonlyAtom,
  Observer,
  Readable,
  ReadonlyAtom
} from './types';

const {
  link,
  propagate,
  endTracking,
  startTracking,
  updateDirtyFlag,
  processComputedUpdate,
  processEffectNotifications
} = createReactiveSystem({
  updateComputed(computed: InternalReadonlyAtom<any>) {
    return computed._update();
  },
  notifyEffect(effect: Effect) {
    effect.notify();
    return true;
  }
});

let activeSub: Subscriber | undefined = undefined;

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
  const isComputed = typeof valueOrFn === 'function';
  const getter = valueOrFn as (read: <U>(atom: Readable<U>) => U) => T;

  // Create plain object atom
  const atom: InternalBaseAtom<T> & Dependency = {
    _snapshot: isComputed ? (undefined as T) : valueOrFn,

    // Dependency fields
    _subs: undefined,
    _subsTail: undefined,

    get(): T {
      if (activeSub !== undefined) {
        link(atom as Dependency, activeSub);
      }
      return atom._snapshot;
    },

    subscribe(observerOrFn: Observer<T> | ((value: T) => void)) {
      const obs = toObserver(observerOrFn);
      const observed = { current: false };
      const e = effect(() => {
        atom.get();
        if (!observed.current) {
          observed.current = true;
        } else {
          obs.next?.(atom._snapshot);
        }
      });

      return {
        unsubscribe: () => {
          e.stop();
        }
      };
    }
  };

  if (isComputed) {
    Object.assign<
      BaseAtom<T>,
      Pick<
        InternalReadonlyAtom<T>,
        '_deps' | '_depsTail' | '_flags' | 'get' | '_update'
      >
    >(atom, {
      _deps: undefined,
      _depsTail: undefined,
      _flags: SubscriberFlags.Computed | SubscriberFlags.Dirty,
      get(): T {
        const flags = (this as unknown as InternalReadonlyAtom<T>)._flags;
        if (flags & (SubscriberFlags.PendingComputed | SubscriberFlags.Dirty)) {
          processComputedUpdate(atom as InternalReadonlyAtom<T>, flags);
        }

        if (activeSub !== undefined) {
          link(atom as Dependency, activeSub);
        }
        return atom._snapshot;
      },
      _update(): boolean {
        const prevSub = activeSub;
        const compare = options?.compare ?? Object.is;
        activeSub = atom as InternalReadonlyAtom<T>;
        startTracking(atom as InternalReadonlyAtom<T>);
        try {
          const oldValue = atom._snapshot;
          const read = (atom: Readable<any>) => atom.get();
          const newValue = getter(read);
          if (oldValue === undefined || !compare(oldValue, newValue)) {
            atom._snapshot = newValue;
            return true;
          }
          return false;
        } finally {
          activeSub = prevSub;
          endTracking(atom as InternalReadonlyAtom<T>);
        }
      }
    });
  } else {
    Object.assign<BaseAtom<T>, Pick<Atom<T>, 'set'>>(atom, {
      set(valueOrFn: T | ((prev: T) => T)): void {
        const compare = options?.compare ?? Object.is;
        const value =
          typeof valueOrFn === 'function'
            ? (valueOrFn as (prev: T) => T)(atom._snapshot)
            : valueOrFn;
        if (compare(atom._snapshot, value)) return;
        atom._snapshot = value;
        const { _subs: subs } = atom;
        if (subs !== undefined) {
          propagate(subs);
          processEffectNotifications();
        }
      }
    });
  }

  return atom as Atom<T> | ReadonlyAtom<T>;
}

interface Effect extends Subscriber {
  notify(): void;
  stop(): void;
}

function effect<T>(fn: () => T): Effect {
  const run = (): T => {
    const prevSub = activeSub;
    activeSub = effectObj;
    startTracking(effectObj);
    try {
      return fn();
    } finally {
      activeSub = prevSub;
      endTracking(effectObj);
    }
  };
  const effectObj: Effect = {
    // Subscriber fields
    _deps: undefined,
    _depsTail: undefined,
    _flags: SubscriberFlags.Effect,

    notify(): void {
      const flags = this._flags;
      if (
        flags & SubscriberFlags.Dirty ||
        (flags & SubscriberFlags.PendingComputed &&
          updateDirtyFlag(this, flags))
      ) {
        run();
      }
    },

    stop(): void {
      startTracking(this);
      endTracking(this);
    }
  };

  run();

  return effectObj;
}
