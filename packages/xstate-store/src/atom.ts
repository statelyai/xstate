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
  updateComputed(computed: ReadonlyAtom<any>) {
    return computed.update();
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
  const atom: BaseAtom<T> & Dependency = {
    snapshot: isComputed ? (undefined as T) : valueOrFn,

    // Dependency fields
    subs: undefined,
    subsTail: undefined,

    get(): T {
      if (activeSub !== undefined) {
        link(atom as Atom<T>, activeSub);
      }
      return atom.snapshot;
    },

    subscribe(observerOrFn: Observer<T> | ((value: T) => void)) {
      const obs = toObserver(observerOrFn);
      const observed = { current: false };
      const e = effect(() => {
        atom.get();
        if (!observed.current) {
          observed.current = true;
        } else {
          obs.next?.(atom.snapshot);
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
    Object.assign(atom, {
      deps: undefined,
      depsTail: undefined,
      flags: SubscriberFlags.Computed | SubscriberFlags.Dirty,
      get(): T {
        const flags = (this as ReadonlyAtom<T>).flags;
        if (flags & (SubscriberFlags.PendingComputed | SubscriberFlags.Dirty)) {
          processComputedUpdate(atom as ReadonlyAtom<T>, flags);
        }

        if (activeSub !== undefined) {
          link(atom as ReadonlyAtom<T>, activeSub);
        }
        return atom.snapshot;
      },
      update(): boolean {
        const prevSub = activeSub;
        const compare = options?.compare ?? Object.is;
        activeSub = atom as ReadonlyAtom<T>;
        startTracking(atom as ReadonlyAtom<T>);
        try {
          const oldValue = atom.snapshot;
          const read = (atom: Readable<any>) => atom.get();
          const newValue = getter(read);
          if (oldValue === undefined || !compare(oldValue, newValue)) {
            atom.snapshot = newValue;
            return true;
          }
          return false;
        } finally {
          activeSub = prevSub;
          endTracking(atom as ReadonlyAtom<T>);
        }
      }
    });
  } else {
    Object.assign(atom as Atom<T>, {
      set(valueOrFn: T | ((prev: T) => T)): void {
        const compare = options?.compare ?? Object.is;
        const value =
          typeof valueOrFn === 'function'
            ? (valueOrFn as (prev: T) => T)(atom.snapshot)
            : valueOrFn;
        if (compare(atom.snapshot, value)) return;
        atom.snapshot = value;
        const subs = (atom as Atom<T>).subs;
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
  const effectObj = {
    // Subscriber fields
    deps: undefined,
    depsTail: undefined,
    flags: SubscriberFlags.Effect,
    fn,

    notify(): void {
      const flags = this.flags;
      if (
        flags & SubscriberFlags.Dirty ||
        (flags & SubscriberFlags.PendingComputed &&
          updateDirtyFlag(this, flags))
      ) {
        this.run();
      }
    },

    run(): T {
      const prevSub = activeSub;
      // eslint-disable-next-line
      activeSub = this;
      startTracking(this);
      try {
        return this.fn();
      } finally {
        activeSub = prevSub;
        endTracking(this);
      }
    },

    stop(): void {
      startTracking(this);
      endTracking(this);
    }
  };

  effectObj.run();

  return effectObj;
}
