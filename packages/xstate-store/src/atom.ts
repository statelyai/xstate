import {
  createReactiveSystem,
  Link,
  Subscriber,
  SubscriberFlags
} from './alien';
import { toObserver } from './toObserver';
import { Atom, AtomOptions, Observer, Readable, ReadonlyAtom } from './types';

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
  if (typeof valueOrFn === 'function') {
    return computed(valueOrFn as () => T, options);
  }

  // Create plain object atom
  const atom: Atom<T> = {
    currentValue: valueOrFn,

    // Dependency fields
    subs: undefined as Link | undefined,
    subsTail: undefined as Link | undefined,

    get(): T {
      if (activeSub !== undefined) {
        link(this, activeSub);
      }
      return this.currentValue;
    },

    set(valueOrFn: T | ((prev: T) => T)): void {
      const compare = options?.compare ?? Object.is;
      const value =
        typeof valueOrFn === 'function'
          ? (valueOrFn as (prev: T) => T)(this.currentValue)
          : valueOrFn;
      if (compare(this.currentValue, value)) return;
      this.currentValue = value;
      const subs = this.subs;
      if (subs !== undefined) {
        propagate(subs);
        processEffectNotifications();
      }
    },

    subscribe(observerOrFn: Observer<T> | ((value: T) => void)) {
      const obs = toObserver(observerOrFn);
      const observed = { current: false };
      const e = effect(() => {
        this.get();
        if (!observed.current) {
          observed.current = true;
        } else {
          obs.next?.(this.currentValue);
        }
      });

      return {
        unsubscribe: () => {
          e.stop();
        }
      };
    }
  };

  return atom;
}

function computed<T>(
  getter: (read: <U>(atom: Readable<U>) => U) => T,
  options?: AtomOptions<T>
): ReadonlyAtom<T> {
  const computedAtom = {
    currentValue: undefined as T | undefined,

    // Dependency fields
    subs: undefined as Link | undefined,
    subsTail: undefined as Link | undefined,

    // Subscriber fields
    deps: undefined as Link | undefined,
    depsTail: undefined as Link | undefined,
    flags: SubscriberFlags.Computed | SubscriberFlags.Dirty,
    observers: undefined as Set<Observer<T>> | undefined,

    getter,
    options,

    get(): T {
      const flags = this.flags;
      if (flags & (SubscriberFlags.PendingComputed | SubscriberFlags.Dirty)) {
        processComputedUpdate(this, flags);
      }
      if (activeSub !== undefined) {
        link(this, activeSub);
      }
      return this.currentValue!;
    },

    update(): boolean {
      const prevSub = activeSub;
      const compare = this.options?.compare ?? Object.is;
      // eslint-disable-next-line
      activeSub = this;
      startTracking(this);
      try {
        const oldValue = this.currentValue;
        const read = (atom: Readable<any>) => atom.get();
        const newValue = this.getter(read);
        if (oldValue === undefined || !compare(oldValue, newValue)) {
          this.currentValue = newValue;
          return true;
        }
        return false;
      } finally {
        activeSub = prevSub;
        endTracking(this);
      }
    },

    subscribe(observerOrFn: Observer<T> | ((value: T) => void)) {
      const obs = toObserver(observerOrFn);
      const observed = { current: false };
      const e = effect(() => {
        this.get();
        if (!observed.current) {
          observed.current = true;
        } else {
          obs.next?.(this.get());
        }
      });

      return {
        unsubscribe: () => {
          e.stop();
        }
      };
    }
  };

  return computedAtom;
}

interface Effect extends Subscriber {
  notify(): void;
  stop(): void;
}

function effect<T>(fn: () => T): Effect {
  const effectObj = {
    // Subscriber fields
    deps: undefined as Link | undefined,
    depsTail: undefined as Link | undefined,
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
